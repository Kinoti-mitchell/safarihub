import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId, slugify } from "@/lib/ids";
import { getProviderForUser, assertProviderApproved } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import {
  normalizeAmenities,
  normalizeCategories,
  normalizeListingKinds,
  normalizeVenueTypes,
  primaryCategory,
} from "@/lib/amenities";
import { expireDueBoosts } from "@/lib/boost";

const MINE_SELECT =
  "*, media:Media(*), roomTypes:RoomType(*), county:County(*), town:Town(*), provider:Provider(*), reviews:Review(count), bookings:Booking(count)";

const PUBLIC_SELECT =
  "*, media:Media(*), roomTypes:RoomType(*), county:County!inner(*), town:Town(*), provider:Provider!inner(*), reviews:Review(rating)";

type CountArray = Array<{ count: number }> | undefined;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const county = searchParams.get("county") || undefined;
    const featured = searchParams.get("featured") === "true";
    const mine = searchParams.get("mine") === "true";
    const q = searchParams.get("q")?.trim() || undefined;
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const guests = searchParams.get("guests");
    const kind = searchParams.get("kind") || undefined;
    const amenity = searchParams.get("amenity") || undefined;

    if (mine) {
      const session = await auth();
      if (!session?.user) return jsonError("Unauthorized", 401);
      const access = await getProviderForUser(session.user.id);
      if (!access && session.user.role !== "ADMIN") {
        return jsonError("Forbidden", 403);
      }

      let query = db
        .from("Listing")
        .select(MINE_SELECT)
        .order("isCover", { referencedTable: "media", ascending: false })
        .order("sortOrder", { referencedTable: "media", ascending: true })
        .limit(1, { referencedTable: "media" })
        .order("updatedAt", { ascending: false });
      if (!(session.user.role === "ADMIN" && !access)) {
        query = query.eq("providerId", access!.provider.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const listings = (data ?? []).map((l) => {
        const rec = l as Record<string, unknown>;
        const reviews = rec.reviews as CountArray;
        const bookings = rec.bookings as CountArray;
        return {
          ...rec,
          _count: {
            reviews: reviews?.[0]?.count ?? 0,
            bookings: bookings?.[0]?.count ?? 0,
          },
        };
      });
      return jsonOk({
        listings,
        provider: access
          ? {
              id: access.provider.id,
              name: access.provider.name,
              slug: access.provider.slug,
              isApproved: Boolean(access.provider.isApproved),
            }
          : null,
      });
    }

    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    const guestN = guests ? Number(guests) : undefined;
    const hasRoomFilter =
      (guestN != null && !Number.isNaN(guestN)) ||
      (min != null && !Number.isNaN(min)) ||
      (max != null && !Number.isNaN(max));

    await expireDueBoosts();

    const select = hasRoomFilter
      ? PUBLIC_SELECT.replace("roomTypes:RoomType(*)", "roomTypes:RoomType!inner(*)")
      : PUBLIC_SELECT;

    let query = db
      .from("Listing")
      .select(select)
      .eq("status", "PUBLISHED")
      .eq("county.isLive", true)
      .eq("provider.isApproved", true)
      .order("isCover", { referencedTable: "media", ascending: false })
      .order("sortOrder", { referencedTable: "media", ascending: true })
      .limit(1, { referencedTable: "media" })
      .order("isPromoted", { ascending: false })
      .order("featured", { ascending: false })
      .order("createdAt", { ascending: false })
      .limit(48);

    if (category) {
      // Match primary column or multi-category JSON array
      query = query.or(
        `category.eq.${category},categories.cs.["${category}"]`,
      );
    }
    if (kind) {
      query = query.contains("listingKinds", [kind.toUpperCase()]);
    }
    if (amenity) {
      query = query.contains("amenities", [amenity]);
    }
    if (county) query = query.eq("county.slug", county);
    if (featured) query = query.or("featured.eq.true,isPromoted.eq.true");
    if (guestN != null && !Number.isNaN(guestN)) {
      query = query.gte("roomTypes.maxGuests", guestN);
    }
    if (min != null && !Number.isNaN(min)) {
      query = query.gte("roomTypes.basePrice", min);
    }
    if (max != null && !Number.isNaN(max)) {
      query = query.lte("roomTypes.basePrice", max);
    }
    if (q) {
      const like = `%${q}%`;
      const { data: providerMatches } = await db
        .from("Provider")
        .select("id")
        .ilike("name", like);
      const ids = (providerMatches ?? []).map((p) => p.id as string);
      const orParts = [`title.ilike.${like}`, `description.ilike.${like}`];
      if (ids.length) orParts.push(`providerId.in.(${ids.join(",")})`);
      query = query.or(orParts.join(","));
    }

    const { data, error } = await query;
    if (error) throw error;
    return jsonOk({ listings: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.enum(["STAY", "EAT", "MOVE", "EXPLORE", "MEET"]).optional(),
  categories: z.array(z.string()).optional(),
  listingKinds: z.array(z.string()).optional(),
  venueTypes: z.array(z.string()).optional(),
  countyId: z.string().min(1),
  townId: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationConfirmed: z.boolean().optional(),
  acceptMpesa: z.boolean().optional(),
  acceptCard: z.boolean().optional(),
  acceptCashOnArrival: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  phone: z.string().max(40).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  menuUrl: z.string().max(500).optional().nullable(),
  openingHours: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const access = await getProviderForUser(session.user.id);
    if (!access && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }
    if (access && session.user.role !== "ADMIN") {
      try {
        assertProviderApproved(access);
      } catch (e) {
        return handleRouteError(e);
      }
    }

    const body = createSchema.parse(await request.json());
    let providerId = access?.provider.id;
    if (!providerId) {
      const { data: anyProvider } = await db
        .from("Provider")
        .select("id")
        .eq("isApproved", true)
        .limit(1)
        .maybeSingle();
      providerId = anyProvider?.id as string | undefined;
    }
    if (!providerId) return jsonError("No provider profile", 400);

    // Prevent duplicate listings — same name in the same county (any provider).
    const title = body.title.trim();
    const { data: dupes } = await db
      .from("Listing")
      .select("id, providerId")
      .eq("countyId", body.countyId)
      .ilike("title", title)
      .limit(1);
    if (dupes && dupes.length > 0) {
      return jsonError(
        dupes[0].providerId === providerId
          ? "You already have a listing with this name in this county"
          : "A listing with this name already exists in this county",
        409,
      );
    }

    const base = slugify(title) || "listing";
    const slug = `${base}-${createId().slice(0, 6)}`;
    const categories = normalizeCategories(
      body.categories?.length ? body.categories : body.category,
    );
    const listingKinds = normalizeListingKinds(body.listingKinds);
    const venueTypes = normalizeVenueTypes(body.venueTypes);
    const now = new Date().toISOString();

    const { data: listing, error } = await db
      .from("Listing")
      .insert({
        id: createId(),
        providerId,
        countyId: body.countyId,
        townId: body.townId || null,
        category: primaryCategory(categories),
        categories,
        listingKinds,
        venueTypes,
        title: body.title,
        slug,
        description: body.description ?? null,
        address: body.address ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        locationConfirmed: body.locationConfirmed ?? false,
        status: "DRAFT",
        acceptMpesa: body.acceptMpesa ?? true,
        acceptCard: body.acceptCard ?? true,
        acceptCashOnArrival: body.acceptCashOnArrival ?? true,
        amenities: normalizeAmenities(body.amenities),
        phone: body.phone?.trim() || null,
        website: body.website?.trim() || null,
        menuUrl: body.menuUrl?.trim() || null,
        openingHours: body.openingHours?.trim() || null,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();
    if (error) throw error;

    return jsonOk({ listing }, 201);
  } catch (error) {
    console.error("Create listing error:", error);
    return handleRouteError(error);
  }
}
