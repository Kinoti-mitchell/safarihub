import { db } from "@/lib/supabase";

/** Inclusive list of calendar dates from check-in (inclusive) to check-out (exclusive). */
export function stayDates(checkIn: Date, checkOut: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(
    Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate()),
  );
  while (cursor < end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayOverlapsBooking(
  day: Date,
  checkIn: Date,
  checkOut: Date,
) {
  return checkIn <= day && checkOut > day;
}

export type DayInventory = {
  date: string;
  total: number;
  booked: number;
  capacity: number;
  available: number;
  price: number | null;
  basePrice: number;
  hasOverride: boolean;
};

/** Build day-by-day inventory: total rooms minus bookings, with optional capacity overrides. */
export async function getRoomInventory(opts: {
  roomTypeId: string;
  from: Date;
  to: Date; // inclusive
}): Promise<{
  room: { id: string; name: string; quantity: number; basePrice: number };
  days: DayInventory[];
}> {
  const endExclusive = new Date(opts.to);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const { data: room, error: roomError } = await db
    .from("RoomType")
    .select("id, name, quantity, basePrice")
    .eq("id", opts.roomTypeId)
    .maybeSingle();
  if (roomError) throw new Error(roomError.message);
  if (!room) throw new Error("Room type not found");

  const { data: availabilityRows, error: availError } = await db
    .from("RoomAvailability")
    .select("date, available, price")
    .eq("roomTypeId", opts.roomTypeId)
    .gte("date", opts.from.toISOString())
    .lte("date", opts.to.toISOString());
  if (availError) throw new Error(availError.message);

  const { data: overlappingRows, error: bookingError } = await db
    .from("Booking")
    .select("roomsBooked, checkIn, checkOut")
    .eq("roomTypeId", opts.roomTypeId)
    .in("status", ["PENDING", "RESERVED", "CONFIRMED"])
    .lt("checkIn", endExclusive.toISOString())
    .gt("checkOut", opts.from.toISOString());
  if (bookingError) throw new Error(bookingError.message);
  const overlapping = overlappingRows ?? [];

  const overrides = new Map(
    (availabilityRows ?? []).map((a) => [
      dateKey(new Date(a.date as string)),
      a as { available: number | null; price: number | null },
    ]),
  );

  const days = stayDates(opts.from, endExclusive).map((day) => {
    const key = dateKey(day);
    const row = overrides.get(key);
    const booked = overlapping.reduce((sum, b) => {
      if (
        dayOverlapsBooking(
          day,
          new Date(b.checkIn as string),
          new Date(b.checkOut as string),
        )
      ) {
        return sum + (b.roomsBooked as number);
      }
      return sum;
    }, 0);
    const capacity = row?.available ?? room.quantity;
    const available = Math.max(0, capacity - booked);
    return {
      date: key,
      total: room.quantity,
      booked,
      capacity,
      available,
      price: row?.price ?? null,
      basePrice: room.basePrice,
      hasOverride: Boolean(row),
    };
  });

  return {
    room: {
      id: room.id,
      name: room.name,
      quantity: room.quantity,
      basePrice: room.basePrice,
    },
    days,
  };
}

export async function checkRoomAvailability(opts: {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  roomsBooked: number;
  /** When true, prefer dayUsePrice (falls back to basePrice). */
  dayUse?: boolean;
}): Promise<{ ok: true; unitPrice: number } | { ok: false; error: string }> {
  const { data: room, error: roomError } = await db
    .from("RoomType")
    .select("id, quantity, basePrice, dayUsePrice")
    .eq("id", opts.roomTypeId)
    .maybeSingle();
  if (roomError) return { ok: false, error: roomError.message };
  if (!room) return { ok: false, error: "Room type not found" };
  if (opts.roomsBooked < 1) {
    return { ok: false, error: "Rooms booked must be at least 1" };
  }
  if (room.quantity < opts.roomsBooked) {
    return { ok: false, error: "Not enough rooms available" };
  }

  const dates = stayDates(opts.checkIn, opts.checkOut);
  if (dates.length === 0) return { ok: false, error: "Invalid dates" };

  const last = dates[dates.length - 1];
  const { days } = await getRoomInventory({
    roomTypeId: opts.roomTypeId,
    from: dates[0],
    to: last,
  });

  const dayRate =
    opts.dayUse && room.dayUsePrice != null && room.dayUsePrice > 0
      ? (room.dayUsePrice as number)
      : (room.basePrice as number);

  let unitPrice = dayRate;
  for (const day of days) {
    if (day.available < opts.roomsBooked) {
      return { ok: false, error: `Not enough rooms on ${day.date}` };
    }
    // Day-use ignores overnight price overrides; overnight uses overrides.
    if (!opts.dayUse && day.price != null) unitPrice = day.price;
  }

  return { ok: true, unitPrice };
}
