import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";

/**
 * Flip past, still-active bookings to COMPLETED so guests can leave reviews and
 * providers see accurate history.
 *
 * Prefer the scheduled cron (`/api/cron/complete-bookings`). Also called
 * opportunistically when a traveler or provider lists bookings.
 * Best-effort when scoped; cron path throws on DB errors.
 */
export async function autoCompletePastBookings(scope: {
  travelerId?: string;
  listingIds?: string[];
  /** Platform-wide (cron). Caps batch size. */
  all?: boolean;
  limit?: number;
}): Promise<{ completed: number }> {
  const soft = !scope.all;
  try {
    const nowIso = new Date().toISOString();
    const limit = scope.limit ?? (scope.all ? 200 : 50);
    let query = db
      .from("Booking")
      .select("id, reviewToken")
      .lt("checkOut", nowIso)
      .in("status", ["CONFIRMED", "RESERVED"])
      .limit(limit);

    if (scope.all) {
      // no extra filter
    } else if (scope.travelerId) {
      query = query.eq("travelerId", scope.travelerId);
    } else if (scope.listingIds && scope.listingIds.length > 0) {
      query = query.in("listingId", scope.listingIds);
    } else {
      return { completed: 0 };
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    let completed = 0;
    for (const row of rows ?? []) {
      const patch: Record<string, unknown> = {
        status: "COMPLETED",
        updatedAt: nowIso,
      };
      if (!(row.reviewToken as string | null)) {
        patch.reviewToken = createId();
      }
      const { error: upErr } = await db
        .from("Booking")
        .update(patch)
        .eq("id", row.id as string);
      if (upErr) throw upErr;
      completed += 1;
    }
    return { completed };
  } catch (error) {
    console.error("autoCompletePastBookings failed", error);
    if (!soft) throw error;
    return { completed: 0 };
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
