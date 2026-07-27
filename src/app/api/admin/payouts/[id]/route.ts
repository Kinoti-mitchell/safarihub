import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
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
        "id, status, amount, providerId, bookingId, provider:Provider(name, phone)",
      )
      .eq("id", id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return jsonError("Not found", 404);

    let nextStatus = body.status;
    let b2cNote: string | null = null;

    if (body.sendMpesa) {
      if (!(await isB2cConfigured())) {
        return jsonError(
          "Configure Daraja B2C (initiator + security credential) in Settings → M-Pesa first",
          400,
        );
      }
      const provider = existing.provider as {
        name?: string;
        phone?: string | null;
      } | null;
      const phone = provider?.phone;
      if (!phone) {
        return jsonError(
          "Provider has no phone number on file — add it before paying via M-Pesa",
          400,
        );
      }
      const sent = await b2cPayment({
        phone,
        amount: existing.amount as number,
        reference: `PAYOUT-${id.slice(0, 8)}`,
        remarks: `Safari Hub payout to ${provider?.name || "provider"}`,
      });
      if (!sent.ok) return jsonError(sent.error, 502);
      nextStatus = "PROCESSING";
      b2cNote =
        sent.conversationId || sent.originatorConversationId || "B2C sent";
      await db
        .from("Payout")
        .update({
          status: "PROCESSING",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id);
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
      .select("userId")
      .eq("providerId", existing.providerId as string);
    for (const m of members ?? []) {
      await notify({
        userId: m.userId as string,
        type: `payout.${String(status).toLowerCase()}`,
        title: body.sendMpesa
          ? "Payout sent via M-Pesa"
          : `Payout ${String(status).toLowerCase()}`,
        body: `KES ${(existing.amount as number).toLocaleString()} is now ${String(status).toLowerCase()}.`,
        href: "/provider/payouts",
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
