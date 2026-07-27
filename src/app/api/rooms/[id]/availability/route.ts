import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getProviderForUser } from "@/lib/provider";
import { dateKey, getRoomInventory, stayDates } from "@/lib/availability";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function utcDay(isoOrDate: string | Date) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: roomTypeId } = await params;
    const { searchParams } = new URL(request.url);
    const toParam = searchParams.get("to");

    const { data: room, error: findError } = await db
      .from("RoomType")
      .select("*, listing:Listing(*, provider:Provider(createdAt, id))")
      .eq("id", roomTypeId)
      .maybeSingle();
    if (findError) throw findError;
    if (!room) return jsonError("Not found", 404);

    const listing = room.listing as {
      providerId: string;
      provider: { createdAt: string; id: string };
    };
    // From is always the day the provider registered — not editable
    const registeredOn = utcDay(listing.provider.createdAt);
    const from = registeredOn;

    // To optional: default 14 days from registration (or from today if registration is old)
    let to: Date;
    if (toParam) {
      to = utcDay(toParam);
      if (to < from) {
        return jsonError("To date cannot be before registration date", 400);
      }
    } else {
      const today = utcDay(new Date());
      const start = from > today ? from : today;
      to = new Date(start);
      to.setUTCDate(to.getUTCDate() + 13);
      if (to < from) to = new Date(from);
    }

    const inventory = await getRoomInventory({ roomTypeId, from, to });
    const registeredDate = dateKey(registeredOn);

    return jsonOk({
      room: inventory.room,
      days: inventory.days,
      from: registeredDate,
      to: inventory.days[inventory.days.length - 1]?.date ?? registeredDate,
      registeredOn: registeredDate,
      summary: {
        totalRooms: inventory.room.quantity,
        openToday:
          inventory.days.find((d) => d.date === dateKey(utcDay(new Date())))
            ?.available ??
          inventory.days[0]?.available ??
          inventory.room.quantity,
        bookedInRange: inventory.days.reduce((s, d) => s + d.booked, 0),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const putSchema = z.object({
  from: z.string().min(1, "From date is required"),
  to: z.string().optional().nullable(),
  available: z.number().int().min(0),
  price: z.number().int().min(0).optional().nullable(),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id: roomTypeId } = await params;

    const { data: room, error: findError } = await db
      .from("RoomType")
      .select("*, listing:Listing(*, provider:Provider(createdAt, id))")
      .eq("id", roomTypeId)
      .maybeSingle();
    if (findError) throw findError;
    if (!room) return jsonError("Not found", 404);

    const listing = room.listing as {
      providerId: string;
      provider: { createdAt: string; id: string };
    };
    const access = await getProviderForUser(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && access?.provider.id !== listing.providerId) {
      return jsonError("Forbidden", 403);
    }

    const body = putSchema.parse(await request.json());
    if (body.available > room.quantity) {
      return jsonError(
        `Cannot set capacity above total rooms (${room.quantity})`,
        400,
      );
    }

    const registeredOn = utcDay(listing.provider.createdAt);
    const registeredKey = dateKey(registeredOn);
    const fromDate = utcDay(body.from);

    if (dateKey(fromDate) !== registeredKey) {
      return jsonError(
        `From date must be your registration day (${registeredKey})`,
        400,
      );
    }

    // To optional — if omitted, apply only to the From day
    const toDate = body.to ? utcDay(body.to) : fromDate;
    if (toDate < fromDate) {
      return jsonError("To date cannot be before From date", 400);
    }

    const endExclusive = new Date(toDate);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const dates = stayDates(fromDate, endExclusive);
    if (!dates.length) return jsonError("Invalid date range", 400);

    const results = [];
    for (const date of dates) {
      const iso = date.toISOString();
      const { data: existing } = await db
        .from("RoomAvailability")
        .select("id")
        .eq("roomTypeId", roomTypeId)
        .eq("date", iso)
        .maybeSingle();

      if (existing) {
        const { data: row, error } = await db
          .from("RoomAvailability")
          .update({ available: body.available, price: body.price ?? null })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        results.push(row);
      } else {
        const { data: row, error } = await db
          .from("RoomAvailability")
          .insert({
            id: createId(),
            roomTypeId,
            date: iso,
            available: body.available,
            price: body.price ?? null,
          })
          .select("*")
          .single();
        if (error) throw error;
        results.push(row);
      }
    }

    const inventory = await getRoomInventory({
      roomTypeId,
      from: fromDate,
      to: toDate,
    });

    return jsonOk({
      availability: results,
      days: inventory.days,
      registeredOn: registeredKey,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
