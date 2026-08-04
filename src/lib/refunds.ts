import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { reverseMpesaTransaction, isDarajaConfigured } from "@/lib/mpesa";
import { recordPaymentEvent } from "@/lib/payment-events";
import { notifyAndEmail } from "@/lib/notify";

export type RefundResult =
  | { ok: true; refundId: string; status: string; message: string }
  | { ok: false; error: string; status: number };

/**
 * Create a refund for a paid booking payment.
 * - mpesa: attempts Daraja Transaction Reversal when configured
 * - manual: marks ledger refunded after admin confirms money left the platform
 */
export async function requestBookingRefund(opts: {
  bookingId: string;
  actorId: string | null;
  actor?: { id?: string | null; name?: string | null; email?: string | null };
  amount?: number;
  method?: "MPESA_REVERSAL" | "MANUAL";
  note?: string;
  /** Skip Daraja and only update ledger (after external refund). */
  markCompleted?: boolean;
}): Promise<RefundResult> {
  const { data: booking } = await db
    .from("Booking")
    .select(
      "id, reference, paymentStatus, paymentMethod, totalAmount, amountPaid, travelerId, guestEmail, guestName, accessToken, listing:Listing(title, providerId)",
    )
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found", status: 404 };

  if (
    booking.paymentStatus !== "PAID" &&
    booking.paymentStatus !== "REFUNDED"
  ) {
    return {
      ok: false,
      error: `Cannot refund a booking with payment status ${booking.paymentStatus}`,
      status: 400,
    };
  }

  const { data: payment } = await db
    .from("Payment")
    .select("*")
    .eq("bookingId", opts.bookingId)
    .in("status", ["PAID", "REFUNDED"])
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment && booking.paymentStatus !== "REFUNDED") {
    return { ok: false, error: "No paid payment row found", status: 400 };
  }

  const amount =
    opts.amount ??
    (Number(
      payment?.amountReceived ||
        payment?.amount ||
        booking.amountPaid ||
        booking.totalAmount,
    ) || 0);
  if (amount <= 0) {
    return { ok: false, error: "Refund amount must be positive", status: 400 };
  }

  const method =
    opts.method ||
    (booking.paymentMethod === "MPESA" ? "MPESA_REVERSAL" : "MANUAL");
  const now = new Date().toISOString();
  const refundId = createId();

  await db.from("Refund").insert({
    id: refundId,
    paymentId: (payment?.id as string) ?? null,
    bookingId: opts.bookingId,
    amount,
    method,
    status: opts.markCompleted ? "COMPLETED" : "PENDING",
    note: opts.note ?? null,
    requestedById: opts.actorId,
    completedAt: opts.markCompleted ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  await recordPaymentEvent({
    kind: "REFUND_REQUESTED",
    paymentId: (payment?.id as string) ?? null,
    bookingId: opts.bookingId,
    amount,
    status: "PENDING",
    note: opts.note,
    actorId: opts.actorId,
    metadata: { method, refundId },
  });

  // Always kill pending payouts when refunding guest money.
  await db
    .from("Payout")
    .update({
      status: "FAILED",
      holdReason: "Guest refund",
      updatedAt: now,
    })
    .eq("bookingId", opts.bookingId)
    .in("status", ["PENDING", "PROCESSING", "ON_HOLD"]);

  if (opts.markCompleted || method === "MANUAL") {
    return completeRefundLedger({
      refundId,
      bookingId: opts.bookingId,
      paymentId: (payment?.id as string) ?? null,
      amount,
      actor: opts.actor,
      note: opts.note || (method === "MANUAL" ? "Manual refund recorded" : null),
      method,
      mpesaReceipt: null,
    });
  }

  // M-Pesa reversal
  if (!(await isDarajaConfigured())) {
    await db
      .from("Refund")
      .update({
        status: "FAILED",
        errorMessage:
          "Daraja not configured — mark refund completed manually after sending money",
        updatedAt: now,
      })
      .eq("id", refundId);
    await recordPaymentEvent({
      kind: "REFUND_FAILED",
      paymentId: (payment?.id as string) ?? null,
      bookingId: opts.bookingId,
      amount,
      status: "FAILED",
      note: "Daraja not configured",
      actorId: opts.actorId,
      metadata: { refundId },
    });
    return {
      ok: false,
      error:
        "M-Pesa reversal unavailable (Daraja not configured). Use manual refund after sending money externally.",
      status: 400,
    };
  }

  const receipt =
    (payment?.providerRef as string | null) ||
    (payment?.receiptNumber as string | null);
  if (!receipt) {
    await db
      .from("Refund")
      .update({
        status: "FAILED",
        errorMessage: "Missing M-Pesa receipt / providerRef for reversal",
        updatedAt: now,
      })
      .eq("id", refundId);
    return {
      ok: false,
      error:
        "No M-Pesa receipt on the payment — use manual refund after reversing in Daraja portal",
      status: 400,
    };
  }

  const reversed = await reverseMpesaTransaction({
    transactionId: receipt,
    amount,
    remarks: `Refund ${booking.reference}`,
    occasion: booking.reference as string,
  });

  if (!reversed.ok) {
    await db
      .from("Refund")
      .update({
        status: "FAILED",
        errorMessage: reversed.error.slice(0, 500),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", refundId);
    await recordPaymentEvent({
      kind: "REFUND_FAILED",
      paymentId: (payment?.id as string) ?? null,
      bookingId: opts.bookingId,
      amount,
      status: "FAILED",
      note: reversed.error,
      actorId: opts.actorId,
      metadata: { refundId },
    });
    return { ok: false, error: reversed.error, status: 502 };
  }

  await db
    .from("Refund")
    .update({
      status: "PROCESSING",
      conversationId: reversed.conversationId ?? null,
      originatorConversationId: reversed.originatorConversationId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", refundId);

  await recordPaymentEvent({
    kind: "REFUND_SENT",
    paymentId: (payment?.id as string) ?? null,
    bookingId: opts.bookingId,
    amount,
    status: "PROCESSING",
    providerRef: receipt,
    actorId: opts.actorId,
    metadata: {
      refundId,
      conversationId: reversed.conversationId,
    },
  });

  await logAudit({
    actor: opts.actor,
    action: "refund.mpesa_sent",
    entityType: "Refund",
    entityId: refundId,
    summary: `M-Pesa reversal of KES ${amount.toLocaleString()} queued for ${booking.reference}`,
    metadata: { bookingId: opts.bookingId, amount },
  });

  // Optimistically mark ledger refunded — money movement is in flight.
  await completeRefundLedger({
    refundId,
    bookingId: opts.bookingId,
    paymentId: (payment?.id as string) ?? null,
    amount,
    actor: opts.actor,
    note: opts.note || "M-Pesa reversal queued",
    method,
    mpesaReceipt: receipt,
    keepProcessing: true,
  });

  return {
    ok: true,
    refundId,
    status: "PROCESSING",
    message: "M-Pesa reversal requested — ledger marked refunded",
  };
}

async function completeRefundLedger(opts: {
  refundId: string;
  bookingId: string;
  paymentId: string | null;
  amount: number;
  actor?: { id?: string | null; name?: string | null; email?: string | null };
  note?: string | null;
  method: string;
  mpesaReceipt: string | null;
  keepProcessing?: boolean;
}): Promise<RefundResult> {
  const now = new Date().toISOString();
  await db
    .from("Refund")
    .update({
      status: opts.keepProcessing ? "PROCESSING" : "COMPLETED",
      completedAt: opts.keepProcessing ? null : now,
      mpesaReceipt: opts.mpesaReceipt,
      note: opts.note ?? null,
      updatedAt: now,
    })
    .eq("id", opts.refundId);

  if (opts.paymentId) {
    await db
      .from("Payment")
      .update({ status: "REFUNDED", updatedAt: now })
      .eq("id", opts.paymentId);
  }
  await db
    .from("Booking")
    .update({ paymentStatus: "REFUNDED", updatedAt: now })
    .eq("id", opts.bookingId);

  await recordPaymentEvent({
    kind: opts.keepProcessing ? "REFUND_SENT" : "REFUND_COMPLETED",
    paymentId: opts.paymentId,
    bookingId: opts.bookingId,
    amount: opts.amount,
    status: opts.keepProcessing ? "PROCESSING" : "COMPLETED",
    note: opts.note,
    actorId: opts.actor?.id ?? null,
    metadata: { refundId: opts.refundId, method: opts.method },
  });

  await logAudit({
    actor: opts.actor,
    action: opts.keepProcessing ? "refund.processing" : "refund.completed",
    entityType: "Refund",
    entityId: opts.refundId,
    summary: `Refund KES ${opts.amount.toLocaleString()} (${opts.method}) for booking ${opts.bookingId}`,
    metadata: { bookingId: opts.bookingId, amount: opts.amount },
  });

  const { data: booking } = await db
    .from("Booking")
    .select(
      "reference, travelerId, guestEmail, guestName, accessToken, listing:Listing(title)",
    )
    .eq("id", opts.bookingId)
    .maybeSingle();

  if (booking) {
    const token = booking.accessToken as string | null;
    await notifyAndEmail({
      userId: (booking.travelerId as string | null) ?? null,
      email: (booking.guestEmail as string | null) ?? null,
      type: "booking.refunded",
      title: `Refund ${opts.keepProcessing ? "processing" : "completed"} · ${booking.reference}`,
      body: `KES ${opts.amount.toLocaleString()} refund for ${booking.reference} is ${
        opts.keepProcessing ? "processing via M-Pesa" : "recorded"
      }.`,
      href: token
        ? `/bookings/${opts.bookingId}?t=${token}`
        : `/bookings/${opts.bookingId}`,
    });
  }

  return {
    ok: true,
    refundId: opts.refundId,
    status: opts.keepProcessing ? "PROCESSING" : "COMPLETED",
    message: opts.keepProcessing
      ? "Refund processing"
      : "Refund marked completed",
  };
}

/** Admin marks a failed/pending refund as completed after external payout. */
export async function markRefundCompleted(opts: {
  refundId: string;
  actor?: { id?: string | null; name?: string | null; email?: string | null };
  note?: string;
}): Promise<RefundResult> {
  const { data: refund } = await db
    .from("Refund")
    .select("*")
    .eq("id", opts.refundId)
    .maybeSingle();
  if (!refund) return { ok: false, error: "Refund not found", status: 404 };

  return completeRefundLedger({
    refundId: opts.refundId,
    bookingId: refund.bookingId as string,
    paymentId: (refund.paymentId as string | null) ?? null,
    amount: refund.amount as number,
    actor: opts.actor,
    note: opts.note || (refund.note as string | null),
    method: (refund.method as string) || "MANUAL",
    mpesaReceipt: (refund.mpesaReceipt as string | null) ?? null,
  });
}
