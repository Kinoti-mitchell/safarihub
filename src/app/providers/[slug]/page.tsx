import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { expireDueBoosts } from "@/lib/boost";
import { publicListingPath, publicProviderPath } from "@/lib/listing";

type Props = { params: Promise<{ slug: string }> };

type StorefrontListing = {
  id: string;
  slug: string;
  title: string;
  town: { name: string } | null;
  county: { name: string };
  media: Array<{ url: string }>;
  roomTypes: Array<{ basePrice: number }>;
  reviews: Array<{ rating: number }>;
};

type ProviderStorefront = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  logoUrl?: string | null;
  termsAndConditions?: string | null;
  isApproved: boolean;
  listings: StorefrontListing[];
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: provider } = await db
    .from("Provider")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!provider) return { title: "Provider" };
  return {
    title: provider.name,
    description:
      provider.description?.slice(0, 160) ||
      `${provider.name} on Safari Hub — stays and experiences in Kenya`,
    openGraph: {
      title: provider.name,
      description: provider.description || undefined,
      url: publicProviderPath(provider),
    },
  };
}

export default async function ProviderStorefrontPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  let providerRow: Record<string, unknown> | null = null;
  let listings: StorefrontListing[] = [];

  try {
    const { data } = await db
      .from("Provider")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    providerRow = (data as Record<string, unknown> | null) ?? null;

    if (providerRow && (providerRow.isApproved || isAdmin)) {
      await expireDueBoosts();
      const { data: listingRows } = await db
        .from("Listing")
        .select(
          "*, media:Media(*), roomTypes:RoomType(*), county:County!inner(*), town:Town(*), reviews:Review(rating)",
        )
        .eq("providerId", providerRow.id as string)
        .eq("status", "PUBLISHED")
        .eq("county.isLive", true)
        .order("isCover", { referencedTable: "media", ascending: false })
        .order("sortOrder", { referencedTable: "media", ascending: true })
        .limit(1, { referencedTable: "media" })
        .order("isPromoted", { ascending: false })
        .order("featured", { ascending: false })
        .order("createdAt", { ascending: false });
      listings = (listingRows ?? []) as StorefrontListing[];
    }
  } catch {
    providerRow = null;
  }

  if (!providerRow) notFound();

  const approved = Boolean(providerRow.isApproved);

  // Public visitors only see approved businesses
  if (!approved && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Provider
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-lake">
          {String(providerRow.name)}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          This business is not public on Safari Hub yet. It will appear here
          after admin approval and when they publish listings.
        </p>
        <Link
          href="/browse"
          className="mt-6 inline-flex rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand"
        >
          Browse stays &amp; experiences
        </Link>
      </div>
    );
  }

  const provider = {
    ...providerRow,
    listings,
  } as ProviderStorefront;

  const whatsapp = provider.phone
    ? `https://wa.me/${String(provider.phone).replace(/\D/g, "")}`
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {!approved && isAdmin && (
        <p className="mb-4 rounded-lg border border-sun/40 bg-sun/10 px-3 py-2 text-sm text-ink">
          Admin preview — this storefront is not public until the business is
          approved.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-4">
        {provider.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={provider.logoUrl}
            alt={`${provider.name} logo`}
            className="size-16 rounded-xl border border-line bg-white object-contain p-1.5 sm:size-20"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Provider
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-lake sm:text-4xl">
            {provider.name}
          </h1>
        </div>
      </div>
      {provider.description && (
        <p className="mt-3 max-w-2xl text-ink-muted">{provider.description}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {provider.email && (
          <a href={`mailto:${provider.email}`} className="text-lake-bright underline">
            {provider.email}
          </a>
        )}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="text-lake-bright underline"
          >
            WhatsApp
          </a>
        )}
      </div>

      {provider.termsAndConditions?.trim() ? (
        <section className="mt-8 max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-lake">
            Terms &amp; conditions
          </h2>
          <div className="mt-3 whitespace-pre-wrap rounded-xl border border-line/70 bg-sand/30 px-4 py-3 text-sm leading-relaxed text-ink">
            {provider.termsAndConditions}
          </div>
        </section>
      ) : null}

      <h2 className="font-display mt-12 text-2xl font-semibold">Listings</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {provider.listings.map((listing) => {
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
              key={listing.id}
              href={publicListingPath(listing)}
              className="overflow-hidden border border-line bg-white/80 transition hover:border-lake-bright"
            >
              <div className="aspect-[4/3] bg-sand-deep">
                {listing.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.media[0].url}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-wider text-ink-muted">
                  {listing.town?.name || listing.county.name}
                </p>
                <h3 className="font-display mt-1 text-lg font-semibold">
                  {listing.title}
                </h3>
                <div className="mt-3 flex justify-between text-sm">
                  {fromPrice != null ? (
                    <span className="font-semibold text-lake">
                      From KES {fromPrice.toLocaleString()}
                    </span>
                  ) : (
                    <span />
                  )}
                  {avg != null && (
                    <span className="text-ink-muted">{avg.toFixed(1)} ★</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {provider.listings.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted">No published listings yet.</p>
      )}
    </div>
  );
}
