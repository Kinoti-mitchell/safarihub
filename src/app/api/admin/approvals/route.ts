import { db } from "@/lib/supabase";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

function coverFromMedia(
  media: Array<{ url: string; isCover: boolean; sortOrder?: number }>,
): string | null {
  const cover = media.find((m) => m.isCover);
  if (cover) return cover.url;
  const sorted = [...media].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  return sorted[0]?.url ?? null;
}

type RawListing = {
  id: string;
  title: string;
  category: string;
  status: string;
  featured: boolean;
  isPromoted: boolean;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  acceptMpesa: boolean;
  acceptCard: boolean;
  acceptCashOnArrival: boolean;
  amenities: unknown;
  createdAt: string;
  updatedAt: string;
  county: { name: string } | null;
  town: { name: string } | null;
  media: Array<{
    id: string;
    url: string;
    isCover: boolean;
    sortOrder: number;
  }>;
  roomTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    basePrice: number;
    quantity: number;
    maxGuests: number;
  }>;
};

function mapListing(l: RawListing) {
  const prices = l.roomTypes.map((r) => r.basePrice).filter((n) => n > 0);
  const photos = [...l.media].sort((a, b) => {
    if (a.isCover !== b.isCover) return a.isCover ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
  return {
    id: l.id,
    title: l.title,
    category: l.category,
    status: l.status,
    featured: l.featured,
    isPromoted: l.isPromoted,
    description: l.description,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    locationConfirmed: Boolean(l.locationConfirmed),
    acceptMpesa: Boolean(l.acceptMpesa),
    acceptCard: Boolean(l.acceptCard),
    acceptCashOnArrival: Boolean(l.acceptCashOnArrival),
    amenities: Array.isArray(l.amenities) ? l.amenities.map(String) : [],
    county: l.county,
    town: l.town,
    photoCount: l.media.length,
    coverUrl: coverFromMedia(l.media),
    photos: photos.slice(0, 8).map((m) => ({
      id: m.id,
      url: m.url,
      isCover: m.isCover,
    })),
    offerCount: l.roomTypes.length,
    fromPrice: prices.length ? Math.min(...prices) : null,
    offers: l.roomTypes.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      basePrice: r.basePrice,
      quantity: r.quantity,
      maxGuests: r.maxGuests,
    })),
    approvedAt: l.updatedAt,
    createdAt: l.createdAt,
  };
}

// Approved owners with their businesses + listings nested underneath.
export async function GET() {
  try {
    await requireAdminPermission("listing.publish");

    const { data, error } = await db
      .from("Provider")
      .select(
        `id, name, email, phone, commissionRate, isApproved, updatedAt, createdAt,
         members:ProviderMember(
           role,
           user:User(id, name, email, phone)
         ),
         listings:Listing(
           id, title, category, status, featured, isPromoted, description, address,
           latitude, longitude, locationConfirmed,
           acceptMpesa, acceptCard, acceptCashOnArrival, amenities,
           createdAt, updatedAt,
           county:County(name), town:Town(name),
           media:Media(id, url, isCover, sortOrder),
           roomTypes:RoomType(id, name, description, basePrice, quantity, maxGuests)
         )`,
      )
      .eq("isApproved", true)
      .order("updatedAt", { ascending: false })
      .limit(100);
    if (error) throw error;

    type OwnerBucket = {
      ownerId: string;
      ownerName: string;
      ownerEmail: string | null;
      ownerPhone: string | null;
      approvedAt: string;
      businesses: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        commissionRate: number;
        approvedAt: string;
        listingCount: number;
        publishedCount: number;
        listings: ReturnType<typeof mapListing>[];
      }>;
    };

    const byOwner = new Map<string, OwnerBucket>();

    for (const p of data ?? []) {
      const members = (p.members ?? []) as unknown as Array<{
        role: string;
        user: {
          id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
        } | null;
      }>;

      const ownerMember =
        members.find((m) => m.role === "OWNER" && m.user) ||
        members.find((m) => m.user) ||
        null;
      const owner = ownerMember?.user;

      const ownerId = owner?.id || `business:${p.id}`;
      const ownerName =
        owner?.name?.trim() ||
        owner?.email ||
        p.email ||
        "Unknown owner";
      const ownerEmail = owner?.email ?? p.email ?? null;
      const ownerPhone = owner?.phone ?? p.phone ?? null;

      const rawListings = (p.listings ?? []) as unknown as RawListing[];
      const ordered = [...rawListings].sort((a, b) => {
        const rank = (s: string) =>
          s === "PUBLISHED" ? 0 : s === "PENDING_REVIEW" ? 1 : 2;
        const d = rank(a.status) - rank(b.status);
        if (d !== 0) return d;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      const listings = ordered.map(mapListing);

      const business = {
        id: p.id as string,
        name: p.name as string,
        email: (p.email as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
        commissionRate: p.commissionRate as number,
        approvedAt: p.updatedAt as string,
        listingCount: listings.length,
        publishedCount: listings.filter((l) => l.status === "PUBLISHED")
          .length,
        listings,
      };

      const existing = byOwner.get(ownerId);
      if (existing) {
        existing.businesses.push(business);
        if (new Date(business.approvedAt) > new Date(existing.approvedAt)) {
          existing.approvedAt = business.approvedAt;
        }
      } else {
        byOwner.set(ownerId, {
          ownerId,
          ownerName,
          ownerEmail,
          ownerPhone,
          approvedAt: business.approvedAt,
          businesses: [business],
        });
      }
    }

    const approvedOwners = Array.from(byOwner.values())
      .map((o) => {
        o.businesses.sort(
          (a, b) =>
            new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime(),
        );
        const listingCount = o.businesses.reduce(
          (s, b) => s + b.listingCount,
          0,
        );
        const publishedCount = o.businesses.reduce(
          (s, b) => s + b.publishedCount,
          0,
        );
        return {
          ...o,
          businessCount: o.businesses.length,
          listingCount,
          publishedCount,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime(),
      );

    return jsonOk({ approvedOwners });
  } catch (error) {
    return handleRouteError(error);
  }
}
