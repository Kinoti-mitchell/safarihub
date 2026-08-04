import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { openDispute, resolveDispute } from "@/lib/disputes";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("payout.manage");
    const status = new URL(request.url).searchParams.get("status");
    let query = db
      .from("Dispute")
      .select(
        `id, bookingId, providerId, reason, status, guestClaim, providerClaim,
         resolutionNote, refundAmount, holdPayout, createdAt, resolvedAt,
         booking:Booking(reference, status, paymentStatus, guestName, totalAmount),
         provider:Provider(name)`,
      )
      .order("createdAt", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ disputes: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("payout.manage");
    const body = z
      .object({
        bookingId: z.string().min(1),
        reason: z.string().min(3).max(2000),
        guestClaim: z.string().max(2000).optional(),
        providerClaim: z.string().max(2000).optional(),
      })
      .parse(await request.json());

    const result = await openDispute({
      bookingId: body.bookingId,
      openedById: admin.id,
      reason: body.reason,
      guestClaim: body.guestClaim,
      providerClaim: body.providerClaim,
      actor: admin,
    });
    if (!result.ok) return jsonError(result.error, result.status);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminPermission("payout.manage");
    const body = z
      .object({
        disputeId: z.string().min(1),
        resolution: z.enum([
          "RESOLVED_GUEST",
          "RESOLVED_PROVIDER",
          "RESOLVED_PARTIAL",
          "CLOSED",
        ]),
        resolutionNote: z.string().max(2000).optional(),
        refundAmount: z.number().positive().optional(),
      })
      .parse(await request.json());

    const result = await resolveDispute({
      disputeId: body.disputeId,
      resolution: body.resolution,
      resolutionNote: body.resolutionNote,
      refundAmount: body.refundAmount,
      actorId: admin.id,
      actor: admin,
    });
    if (!result.ok) return jsonError(result.error, result.status);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
