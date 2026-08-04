import { db } from "@/lib/supabase";
import { jsonOk } from "@/lib/http";
import { recordPaymentEvent } from "@/lib/payment-events";

/** Daraja B2C timeout — mark matching payout FAILED for ops retry. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      Result?: {
        ConversationID?: string;
        OriginatorConversationID?: string;
        ResultDesc?: string;
      };
    };
    console.info("mpesa b2c timeout", JSON.stringify(body).slice(0, 2000));
    const conversationId = body.Result?.ConversationID;
    const originatorId = body.Result?.OriginatorConversationID;

    let query = db.from("Payout").select("id, bookingId, amount");
    if (conversationId) query = query.eq("b2cConversationId", conversationId);
    else if (originatorId) {
      query = query.eq("b2cOriginatorConversationId", originatorId);
    } else {
      return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: payout } = await query.maybeSingle();
    if (payout) {
      const now = new Date().toISOString();
      await db
        .from("Payout")
        .update({
          status: "FAILED",
          b2cResultDesc: "B2C timeout",
          updatedAt: now,
        })
        .eq("id", payout.id as string)
        .eq("status", "PROCESSING");
      await recordPaymentEvent({
        kind: "B2C_TIMEOUT",
        payoutId: payout.id as string,
        bookingId: payout.bookingId as string,
        amount: payout.amount as number,
        status: "FAILED",
        note: body.Result?.ResultDesc || "B2C timeout",
      });
    }
  } catch (error) {
    console.error("b2c-timeout handler", error);
  }
  return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
}
