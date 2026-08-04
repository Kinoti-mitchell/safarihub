import { db } from "@/lib/supabase";
import { restockRooms } from "@/lib/bookings";
import { notify, notifyAndEmail } from "@/lib/notify";
import { getPlatformSettings, numberSetting } from "@/lib/settings";
import { requestBookingRefund } from "@/lib/refunds";

/**
 * Cancel a booking: mark CANCELLED, restock rooms, refund PAID payments
 * (M-Pesa reversal when possible), cancel pending payouts, and notify both sides.
 */
export async function cancelBooking(opts: {
  bookingId: string;
  cancelledById: string | null;
  reason?: string;
  /** When true, enforce free-cancellation window from settings. */
  asTraveler?: boolean;
  /** Prefer ledger-only refund (default false = attempt M-Pesa reversal). */
  ledgerRefundOnly?: boolean;
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

  const checkIn = new Date(booking.checkIn as string);
  const hoursUntil =
    (checkIn.getTime() - Date.now()) / (1000 * 60 * 60);

  // Past check-in: never cancel via this path (use NO_SHOW / COMPLETED instead).
  if (hoursUntil < 0) {
    return {
      ok: false,
      error: "Too late to cancel — check-in has already passed",
      status: 400,
    };
  }

  // Tourists must cancel outside the free-cancellation window; hosts/admins may.
  if (opts.asTraveler) {
    const settings = await getPlatformSettings();
    const windowHours = numberSetting(
      settings,
      "booking.cancellationWindowHours",
    );
    if (windowHours > 0 && hoursUntil < windowHours) {
      return {
        ok: false,
        error: `Free cancellation closes ${windowHours} hours before check-in. Contact the host or support for help.`,
        status: 400,
      };
    }
  }

  const now = new Date().toISOString();

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

  // Refund paid payments — M-Pesa reversal when possible, else ledger + manual ops.
  if (booking.paymentStatus === "PAID") {
    const method =
      !opts.ledgerRefundOnly && booking.paymentMethod === "MPESA"
        ? "MPESA_REVERSAL"
        : "MANUAL";
    const refund = await requestBookingRefund({
      bookingId: opts.bookingId,
      actorId: opts.cancelledById,
      method,
      markCompleted: method === "MANUAL",
      note: opts.reason || "Booking cancelled",
    });
    // Cancellation still succeeds even if Daraja reversal fails — ops can retry.
    if (!refund.ok && method === "MPESA_REVERSAL") {
      await requestBookingRefund({
        bookingId: opts.bookingId,
        actorId: opts.cancelledById,
        method: "MANUAL",
        markCompleted: true,
        note: `${opts.reason || "Booking cancelled"} (M-Pesa reversal failed: ${refund.error})`,
      });
    }
  } else {
    // Cancel any pending/processing payout for unpaid cancellations.
    await db
      .from("Payout")
      .update({ status: "FAILED", updatedAt: now, holdReason: "Booking cancelled" })
      .eq("bookingId", opts.bookingId)
      .in("status", ["PENDING", "PROCESSING", "ON_HOLD"]);
  }

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
