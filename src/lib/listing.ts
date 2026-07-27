import { db } from "@/lib/supabase";

export { listingCompleteness, publicListingPath, publicProviderPath } from "@/lib/listing-paths";

// PostgREST embed aliased to the camelCase keys the rest of the app expects
// (mirrors the old Prisma `include` shape).
export const LISTING_DETAIL_SELECT =
  "*, media:Media(*), roomTypes:RoomType(*), county:County(*, country:Country(*)), town:Town(*), provider:Provider(*), reviews:Review(*, traveler:User(name))";

export type ListingDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  providerId: string;
  latitude: number | null;
  longitude: number | null;
  media: Array<{ url: string; isCover?: boolean } & Record<string, unknown>>;
  roomTypes: Array<Record<string, unknown>>;
  county: { name: string } & Record<string, unknown>;
  town: ({ name: string } & Record<string, unknown>) | null;
  provider: ({ slug: string; name: string } & Record<string, unknown>) | null;
  reviews: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export async function findListingByIdOrSlug(
  idOrSlug: string,
): Promise<ListingDetail | null> {
  const byId = await queryDetail("id", idOrSlug);
  if (byId) return byId;
  return queryDetail("slug", idOrSlug);
}

async function queryDetail(
  column: "id" | "slug",
  value: string,
): Promise<ListingDetail | null> {
  const { data, error } = await db
    .from("Listing")
    .select(LISTING_DETAIL_SELECT)
    .eq(column, value)
    .order("isCover", { referencedTable: "media", ascending: false })
    .order("sortOrder", { referencedTable: "media", ascending: true })
    .order("createdAt", { referencedTable: "reviews", ascending: false })
    .limit(20, { referencedTable: "reviews" })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ListingDetail | null) ?? null;
}
