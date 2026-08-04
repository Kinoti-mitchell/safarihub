import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";

export type PaymentEventKind =
  | "STK_PUSH"
  | "STK_CALLBACK"
  | "STK_QUERY"
  | "CONFIRM_MANUAL"
  | "CASH_RECORDED"
  | "CARD_CONFIRMED"
  | "REFUND_REQUESTED"
  | "REFUND_SENT"
  | "REFUND_COMPLETED"
  | "REFUND_FAILED"
  | "REFUND_MANUAL"
  | "B2C_SENT"
  | "B2C_RESULT"
  | "B2C_TIMEOUT"
  | "PAYOUT_HOLD"
  | "PAYOUT_RELEASE"
  | "EXCEPTION_RESOLVED";

export async function recordPaymentEvent(opts: {
  kind: PaymentEventKind | string;
  paymentId?: string | null;
  bookingId?: string | null;
  packageBookingId?: string | null;
  payoutId?: string | null;
  providerRef?: string | null;
  amount?: number | null;
  status?: string | null;
  note?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.from("PaymentEvent").insert({
      id: createId(),
      paymentId: opts.paymentId ?? null,
      bookingId: opts.bookingId ?? null,
      packageBookingId: opts.packageBookingId ?? null,
      payoutId: opts.payoutId ?? null,
      kind: opts.kind,
      providerRef: opts.providerRef ?? null,
      amount: opts.amount ?? null,
      status: opts.status ?? null,
      note: opts.note ?? null,
      actorId: opts.actorId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (error) {
    console.error("Failed to write PaymentEvent", error);
  }
}
