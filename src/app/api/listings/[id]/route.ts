import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { userCanAccessProvider, getProviderForUser, assertProviderApproved } from "@/lib/provider";
import {
  findListingByIdOrSlug,
  listingCompleteness,
} from "@/lib/listing";
import {
  getPlatformSettings,
  boolSetting,
  numberSetting,
} from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import {
  normalizeAmenities,
  normalizeCategories,
  normalizeListingKinds,
  normalizeVenueTypes,
  primaryCategory,
} from "@/lib/amenities";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const listing = await findListingByIdOrSlug(id);
    if (!listing) return jsonError("Not found", 404);

    // Unpublished listings only visible to owner/staff/admin
    if (listing.status !== "PUBLISHED") {
      const session = await auth();
      const isAdmin = session?.user?.role === "ADMIN";
      let isOwner = false;
      if (session?.user?.id) {
        isOwner = await userCanAccessProvider(
          session.user.id,
          listing.providerId,
        );
      }
      if (!isAdmin && !isOwner) {
        return jsonError("Not found", 404);
      }
    }

    const settings = await getPlatformSettings();
    const publishFeeKes = numberSetting(settings, "listing.publishFeeKes");
    const publishPaymentInstructions = String(
      settings["listing.publishPaymentInstructions"] || "",
    );
    const paybill = String(settings["payments.mpesaPaybill"] || "");

    return jsonOk({
      listing,
      completeness: listingCompleteness(listing),
      publish: {
        feeKes: publishFeeKes,
        paymentInstructions: publishPaymentInstructions,
        paybill,
        requireListingApproval: boolSetting(
          settings,
          "flags.requireListingApproval",
        ),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  category: z.enum(["STAY", "EAT", "MOVE", "EXPLORE", "MEET"]).optional(),
  categories: z.array(z.string()).optional(),
  listingKinds: z.array(z.string()).optional(),
  venueTypes: z.array(z.string()).optional(),
  address: z.string().optional(),
  countyId: z.string().optional(),
  townId: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  locationConfirmed: z.boolean().optional(),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "SUSPENDED"]).optional(),
  featured: z.boolean().optional(),
  isPromoted: z.boolean().optional(),
  acceptMpesa: z.boolean().optional(),
  acceptCard: z.boolean().optional(),
  acceptCashOnArrival: z.boolean().optional(),
  allowOvernight: z.boolean().optional(),
  allowDayUse: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  phone: z.string().max(40).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  menuUrl: z.string().max(500).optional().nullable(),
  openingHours: z.string().max(500).optional().nullable(),
  /** M-Pesa confirmation for pay-to-publish */
  paymentRef: z.string().min(4).max(80).optional(),
  paymentNote: z.string().max(500).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: listing, error: findError } = await db
      .from("Listing")
      .select("*, media:Media(*), roomTypes:RoomType(*), provider:Provider(*)")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!listing) return jsonError("Not found", 404);

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = await userCanAccessProvider(
      session.user.id,
      listing.providerId,
    );
    if (!isAdmin && !isOwner) {
      return jsonError("Forbidden", 403);
    }

    if (!isAdmin) {
      const access = await getProviderForUser(session.user.id);
      if (!access) return jsonError("Forbidden", 403);
      try {
        assertProviderApproved(access);
      } catch (e) {
        return handleRouteError(e);
      }
    }

    const body = patchSchema.parse(await request.json());

    // Prevent renaming into a duplicate (same name + county as another listing).
    if (body.title || body.countyId) {
      const nextTitle = (body.title ?? listing.title).trim();
      const nextCounty = body.countyId ?? listing.countyId;
      const { data: clashes } = await db
        .from("Listing")
        .select("id")
        .eq("countyId", nextCounty)
        .ilike("title", nextTitle)
        .neq("id", listing.id)
        .limit(1);
      if (clashes && clashes.length > 0) {
        return jsonError(
          "Another listing with this name already exists in this county",
          409,
        );
      }
    }

    // Featured + boost flags are admin-only. Providers request paid boosts
    // via /api/listings/[id]/boost after the listing is published.
    if (!isAdmin) {
      delete body.featured;
      delete body.isPromoted;
    }

    const patch = { ...body } as Record<string, unknown>;
    delete patch.paymentRef;
    delete patch.paymentNote;

    // Providers cannot force-publish or suspend. Publish happens via
    // pay-to-publish (or free publish when fee is 0), or legacy review flag.
    if (!isAdmin) {
      if (body.status === "PUBLISHED" || body.status === "SUSPENDED") {
        return jsonError(
          "Listings go live after publish payment (or instantly when the fee is 0). Admins can suspend listings.",
          403,
        );
      }
      if (body.status === "PENDING_REVIEW") {
        const kinds = normalizeListingKinds(
          body.listingKinds ?? listing.listingKinds,
        );
        const completeness = listingCompleteness({
          description: body.description ?? listing.description,
          latitude:
            body.latitude !== undefined ? body.latitude : listing.latitude,
          longitude:
            body.longitude !== undefined ? body.longitude : listing.longitude,
          media: listing.media,
          roomTypes: listing.roomTypes,
          listingKinds: kinds,
        });
        if (!completeness.complete) {
          return jsonError(
            "Complete the checklist (description, photo, at least one offer/price, and map pin if this is a place/venue) before publishing",
            400,
          );
        }

        const settings = await getPlatformSettings();
        const legacyReview = boolSetting(
          settings,
          "flags.requireListingApproval",
        );
        const feeKes = numberSetting(settings, "listing.publishFeeKes");

        if (legacyReview) {
          patch.status = "PENDING_REVIEW";
          patch.publishPaymentStatus = "NONE";
        } else if (feeKes > 0) {
          const ref = body.paymentRef?.trim();
          if (!ref) {
            return jsonError(
              "Enter your M-Pesa confirmation code to publish this listing",
              400,
            );
          }
          patch.status = "PENDING_REVIEW";
          patch.publishFeeKes = feeKes;
          patch.publishPaymentRef = ref;
          patch.publishPaymentNote = body.paymentNote?.trim() || null;
          patch.publishPaymentStatus = "PENDING_VERIFY";
          patch.publishPaidAt = null;
        } else {
          patch.status = "PUBLISHED";
          patch.publishFeeKes = 0;
          patch.publishPaymentStatus = "WAIVED";
          patch.publishPaidAt = new Date().toISOString();
        }
      }
    }

    if (body.amenities != null) {
      patch.amenities = normalizeAmenities(body.amenities);
    }
    if (body.categories != null || body.category != null) {
      const categories = normalizeCategories(
        body.categories?.length ? body.categories : body.category,
      );
      patch.categories = categories;
      patch.category = primaryCategory(categories);
    }
    if (body.listingKinds != null) {
      patch.listingKinds = normalizeListingKinds(body.listingKinds);
    }
    if (body.venueTypes != null) {
      patch.venueTypes = normalizeVenueTypes(body.venueTypes);
    }
    for (const key of ["phone", "website", "menuUrl", "openingHours"] as const) {
      if (body[key] !== undefined) {
        const v = body[key];
        patch[key] = typeof v === "string" ? v.trim() || null : null;
      }
    }

    const { data: updated, error: updateError } = await db
      .from("Listing")
      .update({ ...patch, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return jsonOk({ listing: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: listing, error: findError } = await db
      .from("Listing")
      .select("id, providerId")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!listing) return jsonError("Not found", 404);
    if (session.user.role !== "ADMIN") {
      const isOwner = await userCanAccessProvider(
        session.user.id,
        listing.providerId,
      );
      if (!isOwner) return jsonError("Forbidden", 403);
    }
    const { error: deleteError } = await db.from("Listing").delete().eq("id", id);
    if (deleteError) throw deleteError;
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
