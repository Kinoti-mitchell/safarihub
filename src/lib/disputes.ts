import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { recordPaymentEvent } from "@/lib/payment-events";
import { notify, notifyAndEmail } from "@/lib/notify";
import { requestBookingRefund } from "@/lib/refunds";

export type DisputeStatus =
  | "OPEN"
  | "HOLDING"
  | "RESOLVED_GUEST"
  | "RESOLVED_PROVIDER"
  | "RESOLVED_PARTIAL"
  | "CLOSED";

async function holdPayoutForBooking(
  bookingId: string,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .from("Payout")
    .update({
      status: "ON_HOLD",
      holdReason: reason,
      updatedAt: now,
    })
    .eq("bookingId", bookingId)
    .in("status", ["PENDING", "PROCESSING"]);

  await recordPaymentEvent({
    kind: "PAYOUT_HOLD",
    bookingId,
    status: "ON_HOLD",
    note: reason,
  });
}

export async function openDispute(opts: {
  bookingId: string;
  openedById: string | null;
  reason: string;
  guestClaim?: string;
  providerClaim?: string;
  actor?: { id?: string | null; name?: string | null; email?: string | null };
}): Promise<
  | { ok: true; disputeId: string }
  | { ok: false; error: string; status: number }
> {
  const { data: booking } = await db
    .from("Booking")
    .select(
      "id, reference, status, paymentStatus, travelerId, guestEmail, listing:Listing(title, providerId)",
    )
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found", status: 404 };

  const listingRaw = booking.listing as
    | { title: string; providerId: string }
    | { title: string; providerId: string }[]
    | null;
  const listing = Array.isArray(listingRaw) ? listingRaw[0] : listingRaw;
  if (!listing?.providerId) {
    return { ok: false, error: "Booking has no provider", status: 400 };
  }

  const { data: existing } = await db
    .from("Dispute")
    .select("id, status")
    .eq("bookingId", opts.bookingId)
    .maybeSingle();
  if (existing && !["CLOSED", "RESOLVED_GUEST", "RESOLVED_PROVIDER", "RESOLVED_PARTIAL"].includes(existing.status as string)) {
    return { ok: false, error: "Dispute already open", status: 400 };
  }

  const now = new Date().toISOString();
  const disputeId = createId();
  await db.from("Dispute").insert({
    id: disputeId,
    bookingId: opts.bookingId,
    providerId: listing.providerId,
    openedById: opts.openedById,
    reason: opts.reason.slice(0, 2000),
    status: "HOLDING",
    guestClaim: opts.guestClaim?.slice(0, 2000) ?? null,
    providerClaim: opts.providerClaim?.slice(0, 2000) ?? null,
    holdPayout: true,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .from("Booking")
    .update({ disputeStatus: "HOLDING", updatedAt: now })
    .eq("id", opts.bookingId);

  await holdPayoutForBooking(opts.bookingId, `Dispute: ${opts.reason}`);

  await logAudit({
    actor: opts.actor,
    action: "dispute.opened",
    entityType: "Dispute",
    entityId: disputeId,
    summary: `Dispute opened on ${booking.reference}: ${opts.reason}`,
    metadata: { bookingId: opts.bookingId },
  });

  return { ok: true, disputeId };
}

export async function markNoShow(opts: {
  bookingId: string;
  actorId: string | null;
  note?: string;
  holdPayout?: boolean;
  actor?: { id?: string | null; name?: string | null; email?: string | null };
}): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  const { data: booking } = await db
    .from("Booking")
    .select("id, reference, status, paymentStatus, travelerId, guestEmail")
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found", status: 404 };
  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status as string)) {
    return {
      ok: false,
      error: `Cannot mark no-show on ${booking.status}`,
      status: 400,
    };
  }

  const now = new Date().toISOString();
  await db
    .from("Booking")
    .update({
      status: "NO_SHOW",
      noShowAt: now,
      noShowById: opts.actorId,
      noShowNote: opts.note?.slice(0, 1000) ?? null,
      updatedAt: now,
    })
    .eq("id", opts.bookingId);

  const hold = opts.holdPayout !== false && booking.paymentStatus === "PAID";
  if (hold) {
    await holdPayoutForBooking(
      opts.bookingId,
      opts.note || "No-show — payout held pending review",
    );
    // Open a light dispute record for ops visibility
    const { data: listing } = await db
      .from("Booking")
      .select("listing:Listing(providerId)")
      .eq("id", opts.bookingId)
      .maybeSingle();
    const listingJoin = listing?.listing as
      | { providerId?: string }
      | { providerId?: string }[]
      | null;
    const providerId = (
      Array.isArray(listingJoin) ? listingJoin[0] : listingJoin
    )?.providerId;
    if (providerId) {
      const { data: existing } = await db
        .from("Dispute")
        .select("id")
        .eq("bookingId", opts.bookingId)
        .maybeSingle();
      if (!existing) {
        await db.from("Dispute").insert({
          id: createId(),
          bookingId: opts.bookingId,
          providerId,
          openedById: opts.actorId,
          reason: "NO_SHOW",
          status: "HOLDING",
          providerClaim: opts.note ?? "Guest did not arrive",
          holdPayout: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      await db
        .from("Booking")
        .update({ disputeStatus: "HOLDING", updatedAt: now })
        .eq("id", opts.bookingId);
    }
  }

  await logAudit({
    actor: opts.actor,
    action: "booking.no_show",
    entityType: "Booking",
    entityId: opts.bookingId,
    summary: `No-show on ${booking.reference}${hold ? " (payout held)" : ""}`,
    metadata: { holdPayout: hold, note: opts.note },
  });

  await notifyAndEmail({
    userId: (booking.travelerId as string | null) ?? null,
    email: (booking.guestEmail as string | null) ?? null,
    type: "booking.no_show",
    title: `Marked no-show · ${booking.reference}`,
    body:
      opts.note ||
      "Your booking was marked as no-show. Contact support if this is incorrect.",
    href: `/bookings/${opts.bookingId}`,
  });

  return { ok: true };
}

export async function resolveDispute(opts: {
  disputeId: string;
  resolution:
    | "RESOLVED_GUEST"
    | "RESOLVED_PROVIDER"
    | "RESOLVED_PARTIAL"
    | "CLOSED";
  resolutionNote?: string;
  refundAmount?: number;
  actorId: string | null;
  actor?: { id?: string | null; name?: string | null; email?: string | null };
}): Promise<
  | { ok: true; message: string }
  | { ok: false; error: string; status: number }
> {
  const { data: dispute } = await db
    .from("Dispute")
    .select("*")
    .eq("id", opts.disputeId)
    .maybeSingle();
  if (!dispute) return { ok: false, error: "Dispute not found", status: 404 };

  const bookingId = dispute.bookingId as string;
  const now = new Date().toISOString();
  let message = "Dispute resolved";

  if (
    opts.resolution === "RESOLVED_GUEST" ||
    opts.resolution === "RESOLVED_PARTIAL"
  ) {
    const refund = await requestBookingRefund({
      bookingId,
      actorId: opts.actorId,
      actor: opts.actor,
      amount: opts.refundAmount,
      method: "MANUAL",
      markCompleted: true,
      note:
        opts.resolutionNote ||
        `Dispute ${opts.resolution.toLowerCase()}`,
    });
    if (!refund.ok) {
      return { ok: false, error: refund.error, status: refund.status };
    }
    message =
      opts.resolution === "RESOLVED_PARTIAL"
        ? "Partial refund recorded; payout remains failed/held"
        : "Full guest refund recorded; payout cancelled";
  } else if (opts.resolution === "RESOLVED_PROVIDER") {
    // Release payout back to PENDING if it was held
    await db
      .from("Payout")
      .update({
        status: "PENDING",
        holdReason: null,
        updatedAt: now,
      })
      .eq("bookingId", bookingId)
      .eq("status", "ON_HOLD");
    await recordPaymentEvent({
      kind: "PAYOUT_RELEASE",
      bookingId,
      status: "PENDING",
      note: opts.resolutionNote || "Dispute resolved for provider",
      actorId: opts.actorId,
    });
    message = "Payout released to pending settlement";
  } else {
    message = "Dispute closed";
  }

  await db
    .from("Dispute")
    .update({
      status: opts.resolution,
      resolutionNote: opts.resolutionNote?.slice(0, 2000) ?? null,
      refundAmount: opts.refundAmount ?? null,
      resolvedById: opts.actorId,
      resolvedAt: now,
      updatedAt: now,
    })
    .eq("id", opts.disputeId);

  await db
    .from("Booking")
    .update({ disputeStatus: opts.resolution, updatedAt: now })
    .eq("id", bookingId);

  await logAudit({
    actor: opts.actor,
    action: `dispute.${opts.resolution.toLowerCase()}`,
    entityType: "Dispute",
    entityId: opts.disputeId,
    summary: message,
    metadata: { bookingId, refundAmount: opts.refundAmount },
  });

  const { data: members } = await db
    .from("ProviderMember")
    .select("userId")
    .eq("providerId", dispute.providerId as string);
  for (const m of members ?? []) {
    await notify({
      userId: m.userId as string,
      type: "dispute.resolved",
      title: "Dispute resolved",
      body: message,
      href: "/provider/bookings",
    });
  }

  return { ok: true, message };
}
