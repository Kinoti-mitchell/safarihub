import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit, listAuditLogs } from "@/lib/audit";
import {
  applyFeature,
  clearFeature,
  FEATURE_PERIODS,
  featurePeriodLabel,
  isFeaturePeriod,
} from "@/lib/featured";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdminPermission("listing.publish");
    const { id } = await params;

    const { data: listingRow, error } = await db
      .from("Listing")
      .select(
        "*, provider:Provider(id, name, email, phone, isApproved, commissionRate), county:County(name), town:Town(name), media:Media(id, url, alt, isCover, sortOrder), roomTypes:RoomType(id, name, description, quantity, basePrice, maxGuests, amenities), reviews:Review(count), bookings:Booking(count)",
      )
      .eq("id", id)
      .order("isCover", { referencedTable: "media", ascending: false })
      .order("sortOrder", { referencedTable: "media", ascending: true })
      .order("basePrice", { referencedTable: "roomTypes", ascending: true })
      .maybeSingle();
    if (error) throw error;
    if (!listingRow) return jsonError("Not found", 404);

    const { reviews, bookings, ...listingRest } = listingRow as Record<
      string,
      unknown
    > & {
      reviews?: Array<{ count: number }>;
      bookings?: Array<{ count: number }>;
    };
    const listing = {
      ...listingRest,
      _count: {
        reviews: reviews?.[0]?.count ?? 0,
        bookings: bookings?.[0]?.count ?? 0,
      },
    };

    const history = await listAuditLogs({
      entityType: "Listing",
      entityId: id,
      limit: 30,
    });

    return jsonOk({ listing, history });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("listing.publish");
    const { id } = await params;
    const parsed = z
      .object({
        status: z
          .enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "SUSPENDED"])
          .optional(),
        featured: z.boolean().optional(),
        featurePeriod: z.enum(FEATURE_PERIODS).optional(),
        isPromoted: z.boolean().optional(),
        comment: z.string().max(1000).optional(),
      })
      .parse(await request.json());
    const { comment, featured, featurePeriod, ...rest } = parsed;

    if (featured === true) {
      if (!featurePeriod || !isFeaturePeriod(featurePeriod)) {
        return jsonError("Choose how long this listing stays on the carousel", 400);
      }
      await applyFeature(id, featurePeriod);
    } else if (featured === false) {
      await clearFeature(id);
    }

    const updatePayload: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date().toISOString(),
    };
    // featured / ends handled above — don't clobber with a bare boolean update
    delete updatePayload.featured;
    delete updatePayload.featurePeriod;

    // Confirming publish also marks the publish fee as paid (pay-to-publish).
    if (rest.status === "PUBLISHED") {
      updatePayload.publishPaymentStatus = "PAID";
      updatePayload.publishPaidAt = new Date().toISOString();
    }
    if (rest.status === "DRAFT") {
      updatePayload.publishPaymentStatus = "REJECTED";
    }

    const { data: listing, error } = await db
      .from("Listing")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    const action =
      rest.status === "PUBLISHED"
        ? "listing.publish"
        : rest.status === "DRAFT"
          ? "listing.request_changes"
          : rest.status === "SUSPENDED"
            ? "listing.suspend"
            : featured === true
              ? "listing.feature"
              : featured === false
                ? "listing.unfeature"
                : "listing.update";
    const baseSummary =
      rest.status === "PUBLISHED"
        ? `Confirmed publish payment & published "${listing.title}"${featured ? " (featured)" : ""}`
        : rest.status === "DRAFT"
          ? `Sent "${listing.title}" back (payment rejected / changes needed)`
          : rest.status === "SUSPENDED"
            ? `Suspended "${listing.title}"`
            : featured === true && featurePeriod
              ? `Featured "${listing.title}" on carousel for ${featurePeriodLabel(featurePeriod)}`
              : featured === false
                ? `Removed "${listing.title}" from carousel`
                : `Updated "${listing.title}"`;
    const trimmedComment = comment?.trim();
    await logAudit({
      actor: admin,
      action,
      entityType: "Listing",
      entityId: listing.id,
      summary: trimmedComment
        ? `${baseSummary} — "${trimmedComment}"`
        : baseSummary,
      metadata: {
        ...rest,
        featured,
        featurePeriod,
        comment: trimmedComment,
      },
    });

    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
