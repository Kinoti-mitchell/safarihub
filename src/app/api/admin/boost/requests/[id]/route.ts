import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notifyAndEmail } from "@/lib/notify";
import {
  activateBoostOnListing,
  clearListingBoost,
  isBoostPeriod,
  type BoostPeriod,
} from "@/lib/boost";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  adminNote: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("boost.manage");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const { data: reqRow, error: findError } = await db
      .from("BoostRequest")
      .select(
        "*, listing:Listing(id, title, status, providerId), provider:Provider(id, name)",
      )
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!reqRow) return jsonError("Boost request not found", 404);

    const listing = Array.isArray(reqRow.listing)
      ? reqRow.listing[0]
      : reqRow.listing;
    const provider = Array.isArray(reqRow.provider)
      ? reqRow.provider[0]
      : reqRow.provider;

    if (!listing) return jsonError("Listing missing", 404);

    const now = new Date().toISOString();
    const note = body.adminNote?.trim() || null;

    if (body.action === "approve") {
      if (reqRow.status !== "PENDING_APPROVAL") {
        return jsonError("Only pending requests can be approved", 400);
      }
      if (listing.status !== "PUBLISHED") {
        return jsonError(
          "Listing must be published before a boost can go live",
          400,
        );
      }
      if (!isBoostPeriod(reqRow.period)) {
        return jsonError("Invalid boost period on request", 400);
      }

      const window = await activateBoostOnListing({
        listingId: listing.id,
        period: reqRow.period as BoostPeriod,
      });

      const { data: updated, error } = await db
        .from("BoostRequest")
        .update({
          status: "ACTIVE",
          adminNote: note,
          reviewedById: admin.id,
          reviewedAt: now,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          updatedAt: now,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await logAudit({
        actor: admin,
        action: "boost.approve",
        entityType: "BoostRequest",
        entityId: id,
        summary: `Approved ${reqRow.period} boost for "${listing.title}" (KES ${reqRow.priceKes})`,
        metadata: { paymentRef: reqRow.paymentRef, ...window },
      });

      await notifyProviderMembers(reqRow.providerId, {
        type: "boost.approved",
        title: `Boost approved — ${listing.title}`,
        body: `Your ${String(reqRow.period).toLowerCase()} boost is live until ${new Date(window.endsAt).toLocaleString("en-KE")}.`,
        href: `/provider/listings/${listing.id}`,
      });

      return jsonOk({ request: updated });
    }

    if (body.action === "reject") {
      if (reqRow.status !== "PENDING_APPROVAL") {
        return jsonError("Only pending requests can be rejected", 400);
      }
      const { data: updated, error } = await db
        .from("BoostRequest")
        .update({
          status: "REJECTED",
          adminNote: note,
          reviewedById: admin.id,
          reviewedAt: now,
          updatedAt: now,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await logAudit({
        actor: admin,
        action: "boost.reject",
        entityType: "BoostRequest",
        entityId: id,
        summary: `Rejected boost for "${listing.title}"`,
        metadata: { adminNote: note },
      });

      await notifyProviderMembers(reqRow.providerId, {
        type: "boost.rejected",
        title: `Boost not approved — ${listing.title}`,
        body:
          note ||
          "Your boost request was not approved. Check payment details and try again, or contact support.",
        href: `/provider/listings/${listing.id}`,
      });

      return jsonOk({ request: updated });
    }

    // cancel active boost early
    if (reqRow.status !== "ACTIVE") {
      return jsonError("Only active boosts can be cancelled", 400);
    }
    await clearListingBoost(listing.id);
    const { data: updated, error } = await db
      .from("BoostRequest")
      .update({
        status: "CANCELLED",
        adminNote: note,
        reviewedById: admin.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "boost.cancel",
      entityType: "BoostRequest",
      entityId: id,
      summary: `Cancelled boost for "${listing.title}"`,
      metadata: { provider: provider?.name },
    });

    await notifyProviderMembers(reqRow.providerId, {
      type: "boost.cancelled",
      title: `Boost ended — ${listing.title}`,
      body: note || "Your listing boost was ended by an admin.",
      href: `/provider/listings/${listing.id}`,
    });

    return jsonOk({ request: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function notifyProviderMembers(
  providerId: string,
  n: { type: string; title: string; body: string; href: string },
) {
  const { data: members } = await db
    .from("ProviderMember")
    .select("user:User(id, email)")
    .eq("providerId", providerId);
  for (const row of members ?? []) {
    const user = Array.isArray(row.user) ? row.user[0] : row.user;
    if (!user?.id) continue;
    await notifyAndEmail({
      userId: user.id as string,
      email: (user.email as string) || null,
      ...n,
    });
  }
}
