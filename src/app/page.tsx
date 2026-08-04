import { HomeHero, type HeroSlide } from "@/components/hero-carousel";
import { HomeSearch } from "@/components/home-search";
import { publicCategories } from "@/lib/categories";
import {
  getFeaturedListings,
  getHeroFallbackListings,
  ListingCard,
} from "@/components/catalog";
import { brandFromSettings } from "@/lib/branding";
import { publicListingPath } from "@/lib/listing-paths";
import { amenityLabel } from "@/lib/amenities";
import { boolSetting, getPlatformSettings } from "@/lib/settings";
import { db } from "@/lib/supabase";
import Link from "next/link";

function toHeroSlide(
  listing: Awaited<ReturnType<typeof getFeaturedListings>>[number],
): HeroSlide | null {
  const src = listing.media?.[0]?.url;
  if (!src) return null;
  const ratings = listing.reviews ?? [];
  const ratingAvg =
    ratings.length === 0
      ? null
      : ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
  const intro = listing.description?.trim().replace(/\s+/g, " ") || undefined;
  const amenities = Array.isArray(listing.amenities)
    ? listing.amenities
        .map((a) => amenityLabel(String(a)))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  return {
    key: listing.id,
    src,
    alt: listing.title,
    href: publicListingPath(listing),
    title: listing.title,
    place: listing.town?.name || listing.county.name,
    logoUrl: listing.provider?.logoUrl ?? null,
    intro,
    amenities,
    ratingAvg,
    ratingCount: ratings.length,
  };
}

export default async function HomePage() {
  const [featured, brand, settings, countiesRes] = await Promise.all([
    getFeaturedListings(6),
    brandFromSettings(),
    getPlatformSettings(),
    db
      .from("County")
      .select("name, slug")
      .eq("isLive", true)
      .order("name", { ascending: true })
      .limit(8),
  ]);

  const liveDestinations = (countiesRes.data ?? []) as Array<{
    name: string;
    slug: string;
  }>;

  const acceptMpesa = boolSetting(settings, "payments.mpesaEnabled");
  const acceptCard = boolSetting(settings, "payments.cardEnabled");
  const acceptCash = boolSetting(settings, "payments.cashEnabled");
  const paymentBits = [
    acceptMpesa ? "M-Pesa" : null,
    acceptCard ? "Card" : null,
    acceptCash ? "Cash on arrival" : null,
  ].filter(Boolean) as string[];

  let heroSlides = featured
    .map((l) => toHeroSlide(l))
    .filter((s): s is HeroSlide => Boolean(s));

  if (heroSlides.length < 3) {
    const fallbacks = await getHeroFallbackListings(
      3 - heroSlides.length,
      heroSlides.map((s) => s.key),
    );
    heroSlides = [
      ...heroSlides,
      ...fallbacks
        .map((l) => toHeroSlide(l))
        .filter((s): s is HeroSlide => Boolean(s)),
    ];
  }

  const marketLine = brand.marketName
    ? `across ${brand.marketName}`
    : "in one marketplace";
  const defaultSub =
    brand.heroSubheadline ||
    `Stay, eat, move, explore and meet — hospitality ${marketLine}.`;

  return (
    <div>
      <HomeHero
        slides={heroSlides}
        brand={{
          name: brand.name,
          logoUrl: brand.logoUrl || undefined,
          headline: brand.heroHeadline,
          subheadline: defaultSub,
        }}
      />

      <section className="border-b border-line/60 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Find a place
          </p>
          <div className="mt-3">
            <HomeSearch
              marketName={brand.marketName}
              categories={publicCategories(settings).map((c) => ({
                slug: c.slug,
                label: c.label,
              }))}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            One trip. Every piece.
          </h2>
          <p className="mt-2 text-ink-muted">
            Stays and tours first — the same marketplace operators use to run
            hospitality {marketLine}.
          </p>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line/70 bg-line/70 sm:grid-cols-2 lg:grid-cols-5">
          {publicCategories(settings).map((c) => (
            <Link
              key={c.slug}
              href={`/browse?category=${c.slug}`}
              className="group relative flex min-h-[9.5rem] flex-col justify-end overflow-hidden bg-lake p-4 transition sm:min-h-[11rem]"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${c.image}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-lake/95 via-lake/50 to-transparent" />
              <span className="relative font-display text-lg font-semibold text-sand">
                {c.label}
              </span>
              <span className="relative mt-1 text-xs text-sand/75">
                {c.blurb}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {liveDestinations.length > 0 && (
        <section className="border-b border-line/60 bg-white/50">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Plan your trip
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-lake sm:text-3xl">
                  Destinations
                </h2>
              </div>
              <Link
                href="/destinations"
                className="text-sm font-semibold text-lake-bright hover:text-lake"
              >
                All destinations →
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {liveDestinations.map((d) => (
                <Link
                  key={d.slug}
                  href={`/browse?county=${encodeURIComponent(d.slug)}`}
                  className="rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright hover:text-lake"
                >
                  {d.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Curated
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-lake sm:text-4xl">
                {brand.marketName
                  ? `Featured across ${brand.marketName}`
                  : `Featured on ${brand.name}`}
              </h2>
              <p className="mt-2 text-ink-muted">
                Hand-picked stays, dining, transport and experiences — not
                limited to one category.
              </p>
            </div>
            <Link
              href="/browse"
              className="text-sm font-semibold text-lake-bright hover:text-lake"
            >
              Browse all →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-line/50 bg-white/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-ink-muted sm:px-6">
          {paymentBits.length > 0 && (
            <p>
              <span className="font-semibold text-ink">Pay your way</span>
              <span className="mx-2 text-line">·</span>
              {paymentBits.join(", ")}
            </p>
          )}
          <p>
            <span className="font-semibold text-ink">Verified operators</span>
            <span className="mx-2 text-line">·</span>
            Reviewed before going live
          </p>
          <p>
            <span className="font-semibold text-ink">PWA</span>
            <span className="mx-2 text-line">·</span>
            Works without an app store
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h2 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-8 space-y-6">
              <li className="flex gap-4">
                <span className="font-display text-2xl font-semibold text-sun">
                  01
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    Discover
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Browse verified stays and experiences by destination.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="font-display text-2xl font-semibold text-sun">
                  02
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    Book &amp; pay
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Reserve instantly or on request
                    {paymentBits.length
                      ? `. Pay with ${paymentBits.join(", ").toLowerCase()}.`
                      : "."}
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="font-display text-2xl font-semibold text-sun">
                  03
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    {brand.marketName
                      ? `Enjoy ${brand.marketName}`
                      : `Enjoy your trip`}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Turn up and enjoy — loyalty points on every trip.
                  </p>
                </div>
              </li>
            </ol>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-lake px-6 py-10 sm:px-8">
            <div
              aria-hidden
              className="absolute -right-12 -top-12 size-40 rounded-full bg-sun/20 blur-2xl"
            />
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                className="relative mb-4 h-10 w-auto object-contain opacity-90"
              />
            ) : null}
            <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">
              For operators
            </p>
            <h3 className="relative font-display mt-3 text-2xl font-semibold text-sand sm:text-3xl">
              Run your hospitality business on {brand.name}
            </h3>
            <p className="relative mt-3 text-sm leading-relaxed text-sand/80">
              Listings, bookings, inbox and payouts — tools for hotels, venues,
              tours and transfers, not just a storefront.
            </p>
            <Link
              href="/register?role=provider"
              className="relative mt-6 inline-flex rounded-lg bg-sun px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Become a provider
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
