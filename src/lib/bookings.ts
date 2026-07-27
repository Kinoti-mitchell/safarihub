import { db } from "@/lib/supabase";

/**
 * Flip past, still-active bookings to COMPLETED so guests can leave reviews and
 * providers see accurate history. Called opportunistically when bookings are
 * listed (there is no cron in this deployment). Scoped to a traveler or a
 * provider's listings to keep it cheap. Best-effort; never throws.
 */
export async function autoCompletePastBookings(scope: {
  travelerId?: string;
  listingIds?: string[];
}): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    let query = db
      .from("Booking")
      .update({ status: "COMPLETED", updatedAt: nowIso })
      .lt("checkOut", nowIso)
      .in("status", ["CONFIRMED", "RESERVED"]);

    if (scope.travelerId) {
      query = query.eq("travelerId", scope.travelerId);
    } else if (scope.listingIds && scope.listingIds.length > 0) {
      query = query.in("listingId", scope.listingIds);
    } else {
      return;
    }
    await query;
  } catch (error) {
    console.error("autoCompletePastBookings failed", error);
  }
}

/**
 * Return rooms to inventory for a cancelled booking by bumping availability for
 * each night of the stay. Best-effort; never throws.
 */
export async function restockRooms(booking: {
  roomTypeId: string | null;
  checkIn: string;
  checkOut: string;
  roomsBooked: number;
}): Promise<void> {
  try {
    if (!booking.roomTypeId) return;
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateIso = new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
      ).toISOString();
      const { data: row } = await db
        .from("RoomAvailability")
        .select("id, available")
        .eq("roomTypeId", booking.roomTypeId)
        .eq("date", dateIso)
        .maybeSingle();
      if (row) {
        await db
          .from("RoomAvailability")
          .update({ available: (row.available as number) + booking.roomsBooked })
          .eq("id", row.id as string);
      }
    }
  } catch (error) {
    console.error("restockRooms failed", error);
  }
}
