import { db } from "@/lib/supabase";
import { jsonOk } from "@/lib/http";
import { recordPaymentEvent } from "@/lib/payment-events";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      Result?: {
        ConversationID?: string;
        OriginatorConversationID?: string;
        ResultDesc?: string;
      };
    };
    console.info("mpesa reversal timeout", JSON.stringify(body).slice(0, 1000));
    const conversationId = body.Result?.ConversationID;
    const originatorId = body.Result?.OriginatorConversationID;
    let query = db.from("Refund").select("id, bookingId, paymentId, amount");
    if (conversationId) query = query.eq("conversationId", conversationId);
    else if (originatorId) {
      query = query.eq("originatorConversationId", originatorId);
    } else {
      return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
    }
    const { data: refund } = await query.maybeSingle();
    if (refund) {
      await db
        .from("Refund")
        .update({
          status: "FAILED",
          errorMessage: "Reversal timeout",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", refund.id as string)
        .eq("status", "PROCESSING");
      await recordPaymentEvent({
        kind: "REFUND_FAILED",
        bookingId: refund.bookingId as string,
        paymentId: (refund.paymentId as string) ?? null,
        amount: refund.amount as number,
        status: "FAILED",
        note: "Reversal timeout",
      });
    }
  } catch (error) {
    console.error("reversal-timeout", error);
  }
  return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
}
