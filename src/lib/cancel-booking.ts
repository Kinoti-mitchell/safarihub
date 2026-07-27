import { db } from "@/lib/supabase";
import { restockRooms } from "@/lib/bookings";
import { notify, notifyAndEmail } from "@/lib/notify";

/**
 * Cancel a booking: mark CANCELLED, restock rooms, refund PAID payments,
 * cancel pending payouts, and notify both sides.
 */
export async function cancelBooking(opts: {
  bookingId: string;
  cancelledById: string | null;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: booking } = await db
    .from("Booking")
    .select(
      "*, listing:Listing(title, providerId), traveler:User(id, name, email)",
    )
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Not found", status: 404 };

  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status as string)) {
    return {
      ok: false,
      error: `Cannot cancel a ${String(booking.status).toLowerCase()} booking`,
      status: 400,
    };
  }

  const now = new Date().toISOString();
  const checkIn = new Date(booking.checkIn as string);
  // Free cancellation until check-in day (start of day). After that, only
  // provider/admin should cancel — callers enforce role; we still allow with reason.
  const hoursUntil =
    (checkIn.getTime() - Date.now()) / (1000 * 60 * 60);

  const { error } = await db
    .from("Booking")
    .update({
      status: "CANCELLED",
      cancelledAt: now,
      cancellationReason: opts.reason ?? null,
      cancelledById: opts.cancelledById ?? null,
      updatedAt: now,
    })
    .eq("id", opts.bookingId);
  if (error) throw error;

  await restockRooms({
    roomTypeId: (booking.roomTypeId as string | null) ?? null,
    checkIn: booking.checkIn as string,
    checkOut: booking.checkOut as string,
    roomsBooked: (booking.roomsBooked as number) || 1,
  });

  // Refund paid payments (sandbox / ledger).
  if (booking.paymentStatus === "PAID") {
    await db
      .from("Payment")
      .update({ status: "REFUNDED", updatedAt: now })
      .eq("bookingId", opts.bookingId)
      .eq("status", "PAID");
    await db
      .from("Booking")
      .update({ paymentStatus: "REFUNDED", updatedAt: now })
      .eq("id", opts.bookingId);
  }

  // Cancel any pending/processing payout for this booking.
  await db
    .from("Payout")
    .update({ status: "FAILED", updatedAt: now })
    .eq("bookingId", opts.bookingId)
    .in("status", ["PENDING", "PROCESSING"]);

  const listing = booking.listing as {
    title: string;
    providerId: string;
  } | null;
  const traveler = booking.traveler as {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  const guestEmail =
    (booking.guestEmail as string | null) || traveler?.email || null;
  const guestName =
    (booking.guestName as string | null) || traveler?.name || "Guest";
  const token = booking.accessToken as string | null;
  const manageHref = token
    ? `/bookings/${opts.bookingId}?t=${token}`
    : booking.travelerId
      ? "/account"
      : `/receipts/${opts.bookingId}`;

  await notifyAndEmail({
    userId: (booking.travelerId as string | null) ?? null,
    email: guestEmail,
    type: "booking.cancelled",
    title: `Booking cancelled · ${listing?.title || booking.reference}`,
    body: opts.reason
      ? `Your booking ${booking.reference} was cancelled. Reason: ${opts.reason}. See /legal/cancellation for policy.`
      : `Your booking ${booking.reference} was cancelled.${hoursUntil < 0 ? " (after check-in)" : ""} See /legal/cancellation for refunds.`,
    href: manageHref,
  });

  if (listing?.providerId) {
    const { data: members } = await db
      .from("ProviderMember")
      .select("userId")
      .eq("providerId", listing.providerId);
    for (const m of members ?? []) {
      await notify({
        userId: m.userId as string,
        type: "booking.cancelled",
        title: `Booking cancelled · ${listing.title}`,
        body: `${guestName} cancelled ${booking.reference}`,
        href: "/provider/bookings",
      });
    }
  }

  return { ok: true };
}
