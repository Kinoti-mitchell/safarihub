import { db } from "@/lib/supabase";
import { jsonOk } from "@/lib/http";
import { recordPaymentEvent } from "@/lib/payment-events";

/** Daraja Transaction Reversal result callback. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      Result?: {
        ConversationID?: string;
        OriginatorConversationID?: string;
        ResultCode?: number | string;
        ResultDesc?: string;
        TransactionID?: string;
      };
    };
    console.info("mpesa reversal result", JSON.stringify(body).slice(0, 2000));
    const result = body.Result;
    const conversationId = result?.ConversationID;
    const originatorId = result?.OriginatorConversationID;

    let query = db.from("Refund").select("id, bookingId, paymentId, amount");
    if (conversationId) query = query.eq("conversationId", conversationId);
    else if (originatorId) {
      query = query.eq("originatorConversationId", originatorId);
    } else {
      return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: refund } = await query.maybeSingle();
    if (refund) {
      const ok = Number(result?.ResultCode) === 0;
      const now = new Date().toISOString();
      await db
        .from("Refund")
        .update({
          status: ok ? "COMPLETED" : "FAILED",
          completedAt: ok ? now : null,
          errorMessage: ok ? null : (result?.ResultDesc || "").slice(0, 500),
          mpesaReceipt: result?.TransactionID ?? null,
          updatedAt: now,
        })
        .eq("id", refund.id as string);

      if (ok) {
        if (refund.paymentId) {
          await db
            .from("Payment")
            .update({ status: "REFUNDED", updatedAt: now })
            .eq("id", refund.paymentId as string);
        }
        await db
          .from("Booking")
          .update({ paymentStatus: "REFUNDED", updatedAt: now })
          .eq("id", refund.bookingId as string);
      }

      await recordPaymentEvent({
        kind: ok ? "REFUND_COMPLETED" : "REFUND_FAILED",
        paymentId: (refund.paymentId as string) ?? null,
        bookingId: refund.bookingId as string,
        amount: refund.amount as number,
        status: ok ? "COMPLETED" : "FAILED",
        providerRef: result?.TransactionID ?? conversationId,
        note: result?.ResultDesc,
      });
    }
  } catch (error) {
    console.error("reversal-result handler", error);
  }
  return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
}
