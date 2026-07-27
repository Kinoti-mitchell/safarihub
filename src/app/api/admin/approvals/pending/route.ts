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
  description: string | null;
  address: string | null;
  createdAt: string;
  featured: boolean;
  isPromoted: boolean;
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
    basePrice: number;
    quantity: number;
  }>;
};

function mapListing(l: RawListing) {
  const prices = l.roomTypes.map((r) => r.basePrice).filter((n) => n > 0);
  return {
    id: l.id,
    title: l.title,
    category: l.category,
    status: l.status,
    description: l.description,
    address: l.address,
    createdAt: l.createdAt,
    featured: l.featured,
    isPromoted: l.isPromoted,
    county: l.county,
    town: l.town,
    photoCount: l.media.length,
    coverUrl: coverFromMedia(l.media),
    offerCount: l.roomTypes.length,
    fromPrice: prices.length ? Math.min(...prices) : null,
  };
}

type MemberRow = {
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function resolveOwner(
  members: MemberRow[],
  fallback: { email?: string | null; phone?: string | null; id: string },
) {
  const ownerMember =
    members.find((m) => m.role === "OWNER" && m.user) ||
    members.find((m) => m.user) ||
    null;
  const owner = ownerMember?.user;
  return {
    ownerId: owner?.id || `business:${fallback.id}`,
    ownerName:
      owner?.name?.trim() || owner?.email || fallback.email || "Unknown owner",
    ownerEmail: owner?.email ?? fallback.email ?? null,
    ownerPhone: owner?.phone ?? fallback.phone ?? null,
  };
}

const PROVIDER_SELECT = `
  id, name, email, phone, commissionRate, isApproved, createdAt, updatedAt,
  kycType, idNumber, registrationNumber, kycDocUrl, kycStatus,
  kraPin, companyEmail, postalAddress, businessType,
  operatingDays, opensAt, closesAt, establishedDate,
  latitude, longitude, website, directors, otherDocsUrls, registrantRole,
  ownerIdDocUrl, kraPinDocUrl, registrationCertUrl, businessPermitUrl,
  county:County(name), town:Town(name),
  members:ProviderMember(
    role,
    user:User(id, name, email, phone)
  ),
  listings:Listing(
    id, title, category, status, description, address, createdAt,
    featured, isPromoted,
    county:County(name), town:Town(name),
    media:Media(id, url, isCover, sortOrder),
    roomTypes:RoomType(id, name, basePrice, quantity)
  )
`;

export async function GET() {
  try {
    await requireAdminPermission("listing.publish");

    // Unapproved businesses + any business that has listings awaiting review
    const [unapprovedRes, pendingListingProvidersRes] = await Promise.all([
      db
        .from("Provider")
        .select(PROVIDER_SELECT)
        .eq("isApproved", false)
        .order("createdAt", { ascending: true })
        .limit(100),
      db
        .from("Listing")
        .select("providerId")
        .eq("status", "PENDING_REVIEW")
        .limit(200),
    ]);
    if (unapprovedRes.error) throw unapprovedRes.error;
    if (pendingListingProvidersRes.error) throw pendingListingProvidersRes.error;

    const unapprovedIds = new Set(
      (unapprovedRes.data ?? []).map((p) => p.id as string),
    );
    const extraProviderIds = [
      ...new Set(
        (pendingListingProvidersRes.data ?? [])
          .map((r) => r.providerId as string)
          .filter((id) => id && !unapprovedIds.has(id)),
      ),
    ];

    let approvedWithPending: typeof unapprovedRes.data = [];
    if (extraProviderIds.length) {
      const { data, error } = await db
        .from("Provider")
        .select(PROVIDER_SELECT)
        .in("id", extraProviderIds)
        .order("createdAt", { ascending: true });
      if (error) throw error;
      approvedWithPending = data ?? [];
    }

    const allProviders = [...(unapprovedRes.data ?? []), ...approvedWithPending];

    type Business = {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      isApproved: boolean;
      commissionRate: number;
      createdAt: string;
      kycType: string | null;
      idNumber: string | null;
      registrationNumber: string | null;
      kycDocUrl: string | null;
      kycStatus: string | null;
      kraPin: string | null;
      companyEmail: string | null;
      postalAddress: string | null;
      businessType: string | null;
      operatingDays: string | null;
      opensAt: string | null;
      closesAt: string | null;
      establishedDate: string | null;
      latitude: number | null;
      longitude: number | null;
      website: string | null;
      directors: Array<{
        name: string;
        idNumber?: string | null;
        role?: string | null;
      }>;
      otherDocsUrls: string[];
      registrantRole: string | null;
      ownerIdDocUrl: string | null;
      kraPinDocUrl: string | null;
      registrationCertUrl: string | null;
      businessPermitUrl: string | null;
      countyName: string | null;
      townName: string | null;
      pendingListings: ReturnType<typeof mapListing>[];
      listingCount: number;
    };

    type OwnerBucket = {
      ownerId: string;
      ownerName: string;
      ownerEmail: string | null;
      ownerPhone: string | null;
      createdAt: string;
      businesses: Business[];
    };

    const byOwner = new Map<string, OwnerBucket>();

    for (const p of allProviders) {
      const members = (p.members ?? []) as unknown as MemberRow[];
      const owner = resolveOwner(members, {
        id: p.id as string,
        email: p.email as string | null,
        phone: p.phone as string | null,
      });

      const rawListings = (p.listings ?? []) as unknown as RawListing[];
      const pendingListings = rawListings
        .filter((l) => l.status === "PENDING_REVIEW")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map(mapListing);

      // Skip approved businesses that somehow have no pending listings
      if (p.isApproved && pendingListings.length === 0) continue;

      const countyRel = p.county as { name?: string } | null;
      const townRel = p.town as { name?: string } | null;

      const business: Business = {
        id: p.id as string,
        name: p.name as string,
        email: (p.email as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
        isApproved: Boolean(p.isApproved),
        commissionRate: (p.commissionRate as number) ?? 10,
        createdAt: p.createdAt as string,
        kycType: (p.kycType as string | null) ?? null,
        idNumber: (p.idNumber as string | null) ?? null,
        registrationNumber: (p.registrationNumber as string | null) ?? null,
        kycDocUrl: (p.kycDocUrl as string | null) ?? null,
        kycStatus: (p.kycStatus as string | null) ?? null,
        kraPin: (p.kraPin as string | null) ?? null,
        companyEmail: (p.companyEmail as string | null) ?? null,
        postalAddress: (p.postalAddress as string | null) ?? null,
        businessType: (p.businessType as string | null) ?? null,
        operatingDays: (p.operatingDays as string | null) ?? null,
        opensAt: (p.opensAt as string | null) ?? null,
        closesAt: (p.closesAt as string | null) ?? null,
        establishedDate: (p.establishedDate as string | null) ?? null,
        latitude: (p.latitude as number | null) ?? null,
        longitude: (p.longitude as number | null) ?? null,
        website: (p.website as string | null) ?? null,
        directors: Array.isArray(p.directors)
          ? (p.directors as Array<{
              name: string;
              idNumber?: string | null;
              role?: string | null;
            }>)
          : [],
        otherDocsUrls: Array.isArray(p.otherDocsUrls)
          ? (p.otherDocsUrls as string[])
          : [],
        registrantRole: (p.registrantRole as string | null) ?? null,
        ownerIdDocUrl: (p.ownerIdDocUrl as string | null) ?? null,
        kraPinDocUrl: (p.kraPinDocUrl as string | null) ?? null,
        registrationCertUrl: (p.registrationCertUrl as string | null) ?? null,
        businessPermitUrl: (p.businessPermitUrl as string | null) ?? null,
        countyName: countyRel?.name ?? null,
        townName: townRel?.name ?? null,
        pendingListings,
        listingCount: rawListings.length,
      };

      const existing = byOwner.get(owner.ownerId);
      if (existing) {
        existing.businesses.push(business);
        if (new Date(business.createdAt) < new Date(existing.createdAt)) {
          existing.createdAt = business.createdAt;
        }
      } else {
        byOwner.set(owner.ownerId, {
          ...owner,
          createdAt: business.createdAt,
          businesses: [business],
        });
      }
    }

    const pendingOwners = Array.from(byOwner.values())
      .map((o) => {
        o.businesses.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const pendingBusinessCount = o.businesses.filter(
          (b) => !b.isApproved,
        ).length;
        const pendingListingCount = o.businesses.reduce(
          (s, b) => s + b.pendingListings.length,
          0,
        );
        return {
          ...o,
          businessCount: o.businesses.length,
          pendingBusinessCount,
          pendingListingCount,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

    return jsonOk({
      pendingOwners,
      summary: {
        owners: pendingOwners.length,
        businesses: pendingOwners.reduce((s, o) => s + o.pendingBusinessCount, 0),
        listings: pendingOwners.reduce((s, o) => s + o.pendingListingCount, 0),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
