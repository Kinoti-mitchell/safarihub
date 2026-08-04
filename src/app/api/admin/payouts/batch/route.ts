import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getPlatformName } from "@/lib/branding";
import { b2cPayment, isB2cConfigured } from "@/lib/mpesa";
import { recordPaymentEvent } from "@/lib/payment-events";
import { notifyAndEmail } from "@/lib/notify";

function payoutPhone(provider: {
  payoutPhone?: string | null;
  phone?: string | null;
  kycStatus?: string | null;
  isApproved?: boolean | null;
}): { phone: string | null; block?: string } {
  if (!provider.isApproved) {
    return { phone: null, block: "Provider not approved" };
  }
  if (provider.kycStatus === "REJECTED") {
    return { phone: null, block: "KYC rejected" };
  }
  const phone = (provider.payoutPhone || provider.phone || "").trim();
  if (!phone) {
    return { phone: null, block: "No payout phone on provider profile" };
  }
  return { phone };
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("payout.manage");
    const body = z
      .object({
        payoutIds: z.array(z.string().min(1)).min(1).max(50),
        sendMpesa: z.boolean().optional(),
        markPaid: z.boolean().optional(),
      })
      .parse(await request.json());

    if (!body.sendMpesa && !body.markPaid) {
      return jsonError("Provide sendMpesa or markPaid", 400);
    }

    const { data: rows, error } = await db
      .from("Payout")
      .select(
        `id, status, amount, providerId, bookingId, holdReason,
         provider:Provider(name, phone, payoutPhone, kycStatus, isApproved),
         booking:Booking(reference, status, paymentStatus, disputeStatus)`,
      )
      .in("id", body.payoutIds);
    if (error) throw error;

    const results: Array<{
      id: string;
      ok: boolean;
      error?: string;
      status?: string;
    }> = [];
    const platformName = await getPlatformName();

    for (const row of rows ?? []) {
      const booking = row.booking as {
        reference?: string;
        status?: string;
        paymentStatus?: string;
        disputeStatus?: string | null;
      } | null;
      const provider = row.provider as {
        name?: string;
        phone?: string | null;
        payoutPhone?: string | null;
        kycStatus?: string | null;
        isApproved?: boolean | null;
      } | null;

      if (row.status === "ON_HOLD") {
        results.push({
          id: row.id as string,
          ok: false,
          error: row.holdReason || "Payout on hold (dispute/no-show)",
        });
        continue;
      }
      if (row.status === "PAID") {
        results.push({ id: row.id as string, ok: false, error: "Already paid" });
        continue;
      }
      if (
        booking?.status === "CANCELLED" ||
        booking?.paymentStatus === "REFUNDED"
      ) {
        results.push({
          id: row.id as string,
          ok: false,
          error: "Booking cancelled or refunded",
        });
        continue;
      }
      if (
        booking?.disputeStatus &&
        ["OPEN", "HOLDING"].includes(booking.disputeStatus)
      ) {
        results.push({
          id: row.id as string,
          ok: false,
          error: "Active dispute — release or resolve first",
        });
        continue;
      }
      if (!["PENDING", "FAILED", "PROCESSING"].includes(row.status as string)) {
        results.push({
          id: row.id as string,
          ok: false,
          error: `Cannot settle status ${row.status}`,
        });
        continue;
      }

      const phoneCheck = payoutPhone(provider || {});
      if (phoneCheck.block || !phoneCheck.phone) {
        results.push({
          id: row.id as string,
          ok: false,
          error: phoneCheck.block || "No payout phone",
        });
        continue;
      }

      if (body.markPaid && !body.sendMpesa) {
        const now = new Date().toISOString();
        await db
          .from("Payout")
          .update({ status: "PAID", paidAt: now, updatedAt: now })
          .eq("id", row.id as string);
        await logAudit({
          actor: admin,
          action: "payout.batch_paid",
          entityType: "Payout",
          entityId: row.id as string,
          summary: `Batch marked paid KES ${Number(row.amount).toLocaleString()}`,
        });
        results.push({ id: row.id as string, ok: true, status: "PAID" });
        continue;
      }

      if (body.sendMpesa) {
        if (!(await isB2cConfigured())) {
          results.push({
            id: row.id as string,
            ok: false,
            error: "B2C not configured",
          });
          continue;
        }
        const sent = await b2cPayment({
          phone: phoneCheck.phone,
          amount: row.amount as number,
          reference: `PAYOUT-${String(row.id).slice(0, 8)}`,
          remarks: `${platformName} payout to ${provider?.name || "provider"}`,
        });
        if (!sent.ok) {
          results.push({ id: row.id as string, ok: false, error: sent.error });
          continue;
        }
        const now = new Date().toISOString();
        await db
          .from("Payout")
          .update({
            status: "PROCESSING",
            b2cConversationId: sent.conversationId ?? null,
            b2cOriginatorConversationId:
              sent.originatorConversationId ?? null,
            updatedAt: now,
          })
          .eq("id", row.id as string);
        await recordPaymentEvent({
          kind: "B2C_SENT",
          payoutId: row.id as string,
          bookingId: row.bookingId as string,
          amount: row.amount as number,
          status: "PROCESSING",
          actorId: admin.id,
          metadata: { conversationId: sent.conversationId },
        });
        await logAudit({
          actor: admin,
          action: "payout.batch_b2c",
          entityType: "Payout",
          entityId: row.id as string,
          summary: `Batch B2C KES ${Number(row.amount).toLocaleString()} to ${phoneCheck.phone}`,
        });

        const { data: members } = await db
          .from("ProviderMember")
          .select("userId, user:User(email)")
          .eq("providerId", row.providerId as string);
        for (const m of members ?? []) {
          await notifyAndEmail({
            userId: m.userId as string,
            email: (m.user as { email?: string } | null)?.email ?? null,
            type: "payout.processing",
            title: "Payout sent via M-Pesa",
            body: `KES ${Number(row.amount).toLocaleString()} is processing.`,
            href: "/provider/payouts",
            emailFlag: "notifications.emailOnPayout",
          });
        }
        results.push({
          id: row.id as string,
          ok: true,
          status: "PROCESSING",
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return jsonOk({
      results,
      summary: `${okCount}/${results.length} succeeded`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
