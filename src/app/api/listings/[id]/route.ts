import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { userCanAccessProvider, getProviderForUser, assertProviderApproved } from "@/lib/provider";
import {
  findListingByIdOrSlug,
  listingCompleteness,
} from "@/lib/listing";
import { getPlatformSettings, boolSetting } from "@/lib/settings";
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

    return jsonOk({
      listing,
      completeness: listingCompleteness(listing),
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

    // Only admins can publish or suspend — every new listing needs admin approval
    if (!isAdmin) {
      if (body.status === "PUBLISHED" || body.status === "SUSPENDED") {
        return jsonError(
          "Only an admin can publish or suspend listings",
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
            "Complete the checklist (description, photo, at least one offer/price, and map pin if this is a place/venue) before submitting for admin review",
            400,
          );
        }
        // When admin approval is required, queue for review; otherwise a
        // complete listing publishes immediately (controlled in Settings).
        const settings = await getPlatformSettings();
        body.status = boolSetting(settings, "flags.requireListingApproval")
          ? "PENDING_REVIEW"
          : "PUBLISHED";
      }
    }

    const patch = { ...body } as Record<string, unknown>;
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
