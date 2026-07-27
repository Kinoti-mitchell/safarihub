import { z } from "zod";
import { db } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { createId } from "@/lib/ids";
import {
  assertProviderApproved,
  getProviderForUser,
  userCanAccessProvider,
} from "@/lib/provider";
import { boolSetting, getPlatformSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { expireDueBoosts } from "@/lib/boost";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;

    const { data: listing, error: findError } = await db
      .from("Listing")
      .select("id, providerId, status, isPromoted, boostEndsAt, title")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!listing) return jsonError("Not found", 404);

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = await userCanAccessProvider(
      session.user.id,
      listing.providerId,
    );
    if (!isAdmin && !isOwner) return jsonError("Forbidden", 403);

    await expireDueBoosts();

    const { data: requests, error } = await db
      .from("BoostRequest")
      .select(
        "id, period, priceKes, status, paymentRef, paymentNote, adminNote, startsAt, endsAt, createdAt, plan:BoostPlan(label)",
      )
      .eq("listingId", id)
      .order("createdAt", { ascending: false })
      .limit(20);
    if (error) throw error;

    const rows = (requests ?? []).map((r) => {
      const plan = Array.isArray(r.plan) ? r.plan[0] : r.plan;
      return { ...r, planLabel: plan?.label ?? null, plan: undefined };
    });

    // Refresh listing boost fields after expiry sweep
    const { data: fresh } = await db
      .from("Listing")
      .select("isPromoted, boostEndsAt")
      .eq("id", id)
      .maybeSingle();

    return jsonOk({
      listing: {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        isPromoted: fresh?.isPromoted ?? listing.isPromoted,
        boostEndsAt: fresh?.boostEndsAt ?? listing.boostEndsAt,
      },
      requests: rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  planId: z.string().min(1),
  paymentRef: z.string().min(4).max(80),
  paymentNote: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;

    const access = await getProviderForUser(session.user.id);
    if (!access) return jsonError("Forbidden", 403);
    try {
      assertProviderApproved(access);
    } catch (e) {
      return handleRouteError(e);
    }

    const settings = await getPlatformSettings();
    if (!boolSetting(settings, "boost.enabled")) {
      return jsonError("Listing boosts are currently disabled", 403);
    }

    const { data: listing, error: findError } = await db
      .from("Listing")
      .select("id, providerId, status, title")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!listing) return jsonError("Not found", 404);

    if (listing.providerId !== access.provider.id) {
      return jsonError("Forbidden", 403);
    }
    if (listing.status !== "PUBLISHED") {
      return jsonError(
        "Boost is only available after your listing is approved and published",
        400,
      );
    }

    const body = createSchema.parse(await request.json());
    const paymentRef = body.paymentRef.trim();
    if (paymentRef.length < 4) {
      return jsonError("Enter a valid M-Pesa / payment reference", 400);
    }

    const { data: plan, error: planError } = await db
      .from("BoostPlan")
      .select("*")
      .eq("id", body.planId)
      .eq("active", true)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return jsonError("Boost plan not found or inactive", 404);

    const { data: open } = await db
      .from("BoostRequest")
      .select("id")
      .eq("listingId", id)
      .eq("status", "PENDING_APPROVAL")
      .limit(1);
    if (open && open.length > 0) {
      return jsonError(
        "You already have a boost request awaiting admin review",
        409,
      );
    }

    const now = new Date().toISOString();
    const row = {
      id: createId("boost"),
      listingId: id,
      providerId: listing.providerId,
      planId: plan.id,
      period: plan.period,
      priceKes: plan.priceKes,
      status: "PENDING_APPROVAL",
      paymentRef,
      paymentNote: body.paymentNote?.trim() || null,
      requestedById: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const { data: created, error } = await db
      .from("BoostRequest")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;

    await logAudit({
      actor: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      action: "boost.request",
      entityType: "BoostRequest",
      entityId: created.id,
      summary: `Requested ${plan.period} boost for "${listing.title}" (KES ${plan.priceKes})`,
      metadata: { paymentRef, planId: plan.id },
    });

    // Notify admins in-app
    const { data: admins } = await db
      .from("User")
      .select("id")
      .eq("role", "ADMIN")
      .limit(20);
    for (const admin of admins ?? []) {
      await notify({
        userId: admin.id,
        type: "boost.request",
        title: `Boost request — ${listing.title}`,
        body: `${access.provider.name} paid KES ${plan.priceKes} (${plan.period}). Ref: ${paymentRef}`,
        href: "/admin/boost",
      });
    }

    return jsonOk({ request: created });
  } catch (error) {
    return handleRouteError(error);
  }
}
