import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notifyAndEmail } from "@/lib/notify";
import { getPlatformName } from "@/lib/branding";
import { b2cPayment, isB2cConfigured } from "@/lib/mpesa";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("payout.manage");
    const { id } = await params;
    const body = z
      .object({
        status: z.enum(["PENDING", "PROCESSING", "PAID", "FAILED"]).optional(),
        sendMpesa: z.boolean().optional(),
      })
      .parse(await request.json());

    const { data: existing, error: findErr } = await db
      .from("Payout")
      .select(
        `id, status, amount, providerId, bookingId, holdReason,
         provider:Provider(name, phone, payoutPhone, kycStatus, isApproved),
         booking:Booking(status, paymentStatus, disputeStatus)`,
      )
      .eq("id", id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return jsonError("Not found", 404);

    let nextStatus = body.status;
    let b2cNote: string | null = null;

    if (body.sendMpesa) {
      if (existing.status === "ON_HOLD") {
        return jsonError(
          existing.holdReason || "Payout is on hold (dispute/no-show)",
          400,
        );
      }
      const booking = existing.booking as {
        status?: string;
        paymentStatus?: string;
        disputeStatus?: string | null;
      } | null;
      if (
        booking?.status === "CANCELLED" ||
        booking?.paymentStatus === "REFUNDED"
      ) {
        return jsonError("Cannot pay out a cancelled/refunded booking", 400);
      }
      if (
        booking?.disputeStatus &&
        ["OPEN", "HOLDING"].includes(booking.disputeStatus)
      ) {
        return jsonError("Resolve the dispute before paying out", 400);
      }
      if (!(await isB2cConfigured())) {
        return jsonError(
          "Configure Daraja B2C (initiator + security credential) in Settings → M-Pesa first",
          400,
        );
      }
      const provider = existing.provider as {
        name?: string;
        phone?: string | null;
        payoutPhone?: string | null;
        kycStatus?: string | null;
        isApproved?: boolean | null;
      } | null;
      if (!provider?.isApproved) {
        return jsonError("Provider is not approved", 400);
      }
      if (provider.kycStatus === "REJECTED") {
        return jsonError("Provider KYC is rejected", 400);
      }
      const phone = provider?.payoutPhone || provider?.phone;
      if (!phone) {
        return jsonError(
          "Provider has no payout phone — set it on the business profile before M-Pesa B2C",
          400,
        );
      }
      const platformName = await getPlatformName();
      const sent = await b2cPayment({
        phone,
        amount: existing.amount as number,
        reference: `PAYOUT-${id.slice(0, 8)}`,
        remarks: `${platformName} payout to ${provider?.name || "provider"}`,
      });
      if (!sent.ok) return jsonError(sent.error, 502);
      nextStatus = "PROCESSING";
      b2cNote =
        sent.conversationId || sent.originatorConversationId || "B2C sent";
      await db
        .from("Payout")
        .update({
          status: "PROCESSING",
          b2cConversationId: sent.conversationId ?? null,
          b2cOriginatorConversationId:
            sent.originatorConversationId ?? null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id);
      const { recordPaymentEvent } = await import("@/lib/payment-events");
      await recordPaymentEvent({
        kind: "B2C_SENT",
        payoutId: id,
        bookingId: existing.bookingId as string,
        amount: existing.amount as number,
        status: "PROCESSING",
        actorId: admin.id,
        metadata: { conversationId: sent.conversationId },
      });
    }

    if (!nextStatus && !body.sendMpesa) {
      return jsonError("Provide status or sendMpesa", 400);
    }

    if (nextStatus && !body.sendMpesa) {
      const { error } = await db
        .from("Payout")
        .update({ status: nextStatus, updatedAt: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    }

    const status = nextStatus || existing.status;

    await logAudit({
      actor: admin,
      action: body.sendMpesa
        ? "payout.b2c_sent"
        : `payout.${String(status).toLowerCase()}`,
      entityType: "Payout",
      entityId: id,
      summary: body.sendMpesa
        ? `B2C payout of KES ${(existing.amount as number).toLocaleString()} queued (${b2cNote})`
        : `Payout of KES ${(existing.amount as number).toLocaleString()} marked ${String(status).toLowerCase()}`,
      metadata: { status, b2cNote },
    });

    const { data: members } = await db
      .from("ProviderMember")
      .select("userId, user:User(email)")
      .eq("providerId", existing.providerId as string);
    for (const m of members ?? []) {
      await notifyAndEmail({
        userId: m.userId as string,
        email: (m.user as { email?: string } | null)?.email ?? null,
        type: `payout.${String(status).toLowerCase()}`,
        title: body.sendMpesa
          ? "Payout sent via M-Pesa"
          : `Payout ${String(status).toLowerCase()}`,
        body: `KES ${(existing.amount as number).toLocaleString()} is now ${String(status).toLowerCase()}.`,
        href: "/provider/payouts",
        emailFlag: "notifications.emailOnPayout",
      });
    }

    const { data: payout } = await db
      .from("Payout")
      .select("id, status")
      .eq("id", id)
      .single();

    return jsonOk({
      payout,
      message: body.sendMpesa
        ? "M-Pesa B2C request sent — mark Paid when the provider confirms receipt"
        : undefined,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
