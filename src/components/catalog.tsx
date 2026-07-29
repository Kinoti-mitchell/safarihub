import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/supabase";
import { publicListingPath } from "@/lib/listing-paths";
import { CatalogFilters } from "@/components/catalog-filters";
import {
  CATEGORIES,
  browseHref,
  categoryLabel,
  resolveCategoryEnum,
} from "@/lib/categories";
import { getPlatformSettings } from "@/lib/settings";
import { expireDueFeatures } from "@/lib/featured";

export { CATEGORIES, browseHref, resolveCategoryEnum } from "@/lib/categories";

export type CatalogSearch = {
  q?: string;
  county?: string;
  minPrice?: string;
  maxPrice?: string;
  guests?: string;
  kind?: string;
  amenity?: string;
  /** Category slug (stays) or enum (STAY) */
  category?: string;
};

type CatalogListing = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  amenities?: string[] | null;
  featured?: boolean;
  featuredAt?: string | null;
  featuredEndsAt?: string | null;
  isPromoted: boolean;
  category?: string;
  categories?: string[];
  venueTypes?: string[];
  town: { name: string } | null;
  county: { name: string };
  provider: { name: string; logoUrl?: string | null };
  media: Array<{ url: string }>;
  roomTypes: Array<{ basePrice: number }>;
  reviews: Array<{ rating: number }>;
};

export async function getLiveCounties() {
  try {
    const { data, error } = await db
      .from("County")
      .select("slug, name")
      .eq("isLive", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getListings(
  category?: string,
  search: CatalogSearch = {},
): Promise<CatalogListing[]> {
  try {
    const minPrice = search.minPrice ? Number(search.minPrice) : undefined;
    const maxPrice = search.maxPrice ? Number(search.maxPrice) : undefined;
    const guests = search.guests ? Number(search.guests) : undefined;
    const q = search.q?.trim();
    const cat = category || resolveCategoryEnum(search.category);

    const hasRoomFilter =
      (guests != null && !Number.isNaN(guests)) ||
      (minPrice != null && !Number.isNaN(minPrice)) ||
      (maxPrice != null && !Number.isNaN(maxPrice));

    const roomEmbed = hasRoomFilter
      ? "roomTypes:RoomType!inner(*)"
      : "roomTypes:RoomType(*)";
    const select = `*, county:County!inner(*), town:Town(*), media:Media(*), ${roomEmbed}, provider:Provider!inner(*), reviews:Review(rating)`;

    let query = db
      .from("Listing")
      .select(select)
      .eq("status", "PUBLISHED")
      .eq("county.isLive", true)
      .eq("provider.isApproved", true)
      .order("isCover", { referencedTable: "media", ascending: false })
      .order("sortOrder", { referencedTable: "media", ascending: true })
      .limit(1, { referencedTable: "media" })
      .order("featured", { ascending: false })
      .order("isPromoted", { ascending: false })
      .order("createdAt", { ascending: false })
      .limit(48);

    if (cat) {
      query = query.or(`category.eq.${cat},categories.cs.["${cat}"]`);
    }
    if (search.kind) {
      query = query.contains("listingKinds", [search.kind.toUpperCase()]);
    }
    if (search.amenity) {
      query = query.contains("amenities", [search.amenity]);
    }
    if (search.county) query = query.eq("county.slug", search.county);
    if (guests != null && !Number.isNaN(guests)) {
      query = query.gte("roomTypes.maxGuests", guests);
    }
    if (minPrice != null && !Number.isNaN(minPrice)) {
      query = query.gte("roomTypes.basePrice", minPrice);
    }
    if (maxPrice != null && !Number.isNaN(maxPrice)) {
      query = query.lte("roomTypes.basePrice", maxPrice);
    }
    if (q) {
      const like = `%${q}%`;
      const [{ data: provs }, { data: towns }] = await Promise.all([
        db.from("Provider").select("id").ilike("name", like),
        db.from("Town").select("id").ilike("name", like),
      ]);
      const orParts = [`title.ilike.${like}`, `description.ilike.${like}`];
      const provIds = (provs ?? []).map((p) => p.id as string);
      const townIds = (towns ?? []).map((t) => t.id as string);
      if (provIds.length) orParts.push(`providerId.in.(${provIds.join(",")})`);
      if (townIds.length) orParts.push(`townId.in.(${townIds.join(",")})`);
      query = query.or(orParts.join(","));
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as CatalogListing[];
  } catch {
    return [];
  }
}

/** Admin “Feature on homepage / carousel” — all categories, timed window. */
export async function getFeaturedListings(
  limit = 8,
): Promise<CatalogListing[]> {
  try {
    await expireDueFeatures();

    const now = new Date().toISOString();
    const select =
      "*, county:County!inner(*), town:Town(*), media:Media(*), roomTypes:RoomType(*), provider:Provider!inner(*), reviews:Review(rating)";
    const { data, error } = await db
      .from("Listing")
      .select(select)
      .eq("status", "PUBLISHED")
      .eq("featured", true)
      .eq("county.isLive", true)
      .eq("provider.isApproved", true)
      .or(`featuredEndsAt.is.null,featuredEndsAt.gt.${now}`)
      .order("isCover", { referencedTable: "media", ascending: false })
      .order("sortOrder", { referencedTable: "media", ascending: true })
      .limit(1, { referencedTable: "media" })
      .order("featuredAt", { ascending: false })
      .order("featuredEndsAt", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const rows = (data ?? []) as unknown as CatalogListing[];
    // Newest Feature first; then later end date (stays on carousel longer).
    return rows.sort((a, b) => {
      const aAt = a.featuredAt ? new Date(a.featuredAt).getTime() : 0;
      const bAt = b.featuredAt ? new Date(b.featuredAt).getTime() : 0;
      if (bAt !== aAt) return bAt - aAt;
      const aEnd = a.featuredEndsAt
        ? new Date(a.featuredEndsAt).getTime()
        : 0;
      const bEnd = b.featuredEndsAt
        ? new Date(b.featuredEndsAt).getTime()
        : 0;
      return bEnd - aEnd;
    });
  } catch {
    return [];
  }
}

/** Published listings used to pad the hero when few Features exist. */
export async function getHeroFallbackListings(
  limit = 4,
  excludeIds: string[] = [],
): Promise<CatalogListing[]> {
  try {
    const select =
      "*, county:County!inner(*), town:Town(*), media:Media(*), roomTypes:RoomType(*), provider:Provider!inner(*), reviews:Review(rating)";
    const { data, error } = await db
      .from("Listing")
      .select(select)
      .eq("status", "PUBLISHED")
      .eq("county.isLive", true)
      .eq("provider.isApproved", true)
      .order("isCover", { referencedTable: "media", ascending: false })
      .order("sortOrder", { referencedTable: "media", ascending: true })
      .limit(1, { referencedTable: "media" })
      .order("isPromoted", { ascending: false })
      .order("updatedAt", { ascending: false })
      .limit(Math.max(limit + excludeIds.length, limit));
    if (error) throw error;
    const rows = (data ?? []) as unknown as CatalogListing[];
    return rows
      .filter((r) => !excludeIds.includes(r.id) && r.media?.[0]?.url)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function ListingCard({ listing }: { listing: CatalogListing }) {
  const fromPrice = listing.roomTypes.length
    ? Math.min(...listing.roomTypes.map((r) => r.basePrice))
    : null;
  const avg =
    listing.reviews.length === 0
      ? null
      : listing.reviews.reduce((s, r) => s + r.rating, 0) /
        listing.reviews.length;

  return (
    <Link
      href={publicListingPath(listing)}
      className="card card-interactive group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-deep">
        {listing.media[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.media[0].url}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-end bg-cover bg-center p-4"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(8,45,42,0.2), rgba(8,45,42,0.78)), url('/hero/elephants-savanna.jpg')",
            }}
          >
            <span className="text-sm font-medium text-sand">Photo coming soon</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {listing.featured && (
            <span className="rounded-full bg-sun px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
              Featured
            </span>
          )}
          {listing.isPromoted && !listing.featured && (
            <span className="rounded-full bg-sun/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
              Boosted
            </span>
          )}
        </div>
        {avg !== null && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
            <span className="text-sun">★</span>
            {avg.toFixed(1)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          {listing.town?.name || listing.county.name}
        </p>
        <h2 className="font-display mt-1 text-lg font-semibold text-ink transition-colors group-hover:text-lake">
          {listing.title}
        </h2>
        {(Array.isArray(listing.venueTypes) && listing.venueTypes.length > 0) ||
        (Array.isArray(listing.categories) &&
          listing.categories.length > 1) ? (
          <p className="mt-1 text-xs text-ink-muted">
            {[
              ...(listing.venueTypes || []),
              ...((listing.categories || []).length > 1
                ? (listing.categories || []).map(categoryLabel)
                : []),
            ]
              .slice(0, 4)
              .join(" · ")}
          </p>
        ) : listing.category ? (
          <p className="mt-1 text-xs text-ink-muted">
            {categoryLabel(listing.category)}
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
          {listing.provider.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.provider.logoUrl}
              alt=""
              className="size-5 rounded object-contain"
            />
          ) : null}
          <span className="truncate">{listing.provider.name}</span>
        </p>
        <div className="mt-auto flex items-end justify-between pt-4 text-sm">
          {fromPrice !== null ? (
            <span>
              <span className="block text-xs text-ink-muted">From</span>
              <span className="font-display text-lg font-semibold text-lake">
                KES {fromPrice.toLocaleString()}
              </span>
            </span>
          ) : (
            <span />
          )}
          <span className="text-sm font-semibold text-lake-bright opacity-0 transition group-hover:opacity-100">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}

export async function CatalogPage({
  title,
  category,
  search,
}: {
  title?: string;
  category?: string;
  search?: CatalogSearch;
}) {
  const searchParams = search || {};
  const activeEnum =
    category || resolveCategoryEnum(searchParams.category) || undefined;
  const activeMeta = CATEGORIES.find((c) => c.category === activeEnum);

  const [listings, counties, settings] = await Promise.all([
    getListings(activeEnum, searchParams),
    getLiveCounties(),
    getPlatformSettings(),
  ]);
  const marketName = String(settings["general.marketName"] || "").trim();
  const browseLabel = marketName ? `Browse ${marketName}` : "Browse";

  const heading = title || activeMeta?.label || browseLabel;
  const meta = activeMeta ?? {
    slug: "all",
    category: "STAY" as const,
    label: browseLabel,
    eyebrow: "One marketplace",
    blurb:
      "Stays, dining, transfers, tours and venues — filter by what you need.",
    image: "/hero/elephants-savanna.jpg",
  };

  const filterBase = { ...searchParams };
  delete filterBase.category;

  return (
    <div>
      <div className="border-b border-line/60 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            {heading}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted sm:text-base">
            {meta.blurb}
          </p>
          <p className="mt-3 text-sm font-medium text-ink">
            {listings.length > 0
              ? `${listings.length} listing${listings.length === 1 ? "" : "s"} ready to book`
              : "Try another category or clear filters"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div
          className="flex gap-2 overflow-x-auto pb-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Browse categories"
        >
          <Link
            href={browseHref(filterBase)}
            aria-current={!activeEnum ? "page" : undefined}
            className={`shrink-0 border-b-2 px-1 pb-2 font-medium transition ${
              !activeEnum
                ? "border-lake text-lake"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => {
            const active = c.category === activeEnum;
            return (
              <Link
                key={c.slug}
                href={browseHref({ ...filterBase, category: c.slug })}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 border-b-2 px-1 pb-2 font-medium transition ${
                  active
                    ? "border-lake text-lake"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
        <Suspense
          fallback={
            <p className="mt-6 text-sm text-ink-muted">Loading filters…</p>
          }
        >
          <CatalogFilters
            counties={counties}
            initial={searchParams}
            categorySlug={activeMeta?.slug}
          />
        </Suspense>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        {listings.length === 0 && (
          <div className="mt-10 border border-line/80 bg-white/60 px-6 py-10 text-center sm:px-10">
            <p className="font-display text-lg font-semibold text-ink">
              Nothing matches yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Clear filters, try another county, or switch category — Stay, Eat,
              Move, Explore and Meet share one marketplace.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                href="/browse"
                className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand"
              >
                Show all
              </Link>
              {CATEGORIES.filter((c) => c.category !== activeEnum)
                .slice(0, 3)
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={browseHref({ category: c.slug })}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:border-lake-bright hover:text-ink"
                  >
                    Try {c.label}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
