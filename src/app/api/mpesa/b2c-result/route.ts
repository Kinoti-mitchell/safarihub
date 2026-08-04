import { db } from "@/lib/supabase";
import { jsonOk } from "@/lib/http";
import { recordPaymentEvent } from "@/lib/payment-events";
import { logAudit } from "@/lib/audit";

/**
 * Daraja B2C result callback — update matching Payout by ConversationID.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      Result?: {
        ConversationID?: string;
        OriginatorConversationID?: string;
        ResultCode?: number | string;
        ResultDesc?: string;
        TransactionID?: string;
        ResultParameters?: {
          ResultParameter?: Array<{ Key?: string; Value?: unknown }>;
        };
      };
    };
    console.info("mpesa b2c result", JSON.stringify(body).slice(0, 2000));

    const result = body.Result;
    const conversationId = result?.ConversationID;
    const originatorId = result?.OriginatorConversationID;
    if (!conversationId && !originatorId) {
      return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    let query = db.from("Payout").select("id, bookingId, amount, status");
    if (conversationId) {
      query = query.eq("b2cConversationId", conversationId);
    } else if (originatorId) {
      query = query.eq("b2cOriginatorConversationId", originatorId);
    }
    const { data: payout } = await query.maybeSingle();

    if (payout) {
      const code = Number(result?.ResultCode);
      const ok = code === 0;
      const now = new Date().toISOString();
      await db
        .from("Payout")
        .update({
          status: ok ? "PAID" : "FAILED",
          paidAt: ok ? now : null,
          b2cResultCode: String(result?.ResultCode ?? ""),
          b2cResultDesc: (result?.ResultDesc || "").slice(0, 500),
          updatedAt: now,
        })
        .eq("id", payout.id as string);

      await recordPaymentEvent({
        kind: "B2C_RESULT",
        payoutId: payout.id as string,
        bookingId: payout.bookingId as string,
        amount: payout.amount as number,
        status: ok ? "PAID" : "FAILED",
        providerRef: result?.TransactionID ?? conversationId,
        note: result?.ResultDesc,
        metadata: { resultCode: result?.ResultCode },
      });

      await logAudit({
        action: ok ? "payout.b2c_paid" : "payout.b2c_failed",
        entityType: "Payout",
        entityId: payout.id as string,
        summary: ok
          ? `B2C callback marked payout PAID`
          : `B2C callback failed: ${result?.ResultDesc || code}`,
      });
    }
  } catch (error) {
    console.error("b2c-result handler", error);
  }
  return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
}
