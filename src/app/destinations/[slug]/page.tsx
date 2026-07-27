import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { guideBySlug } from "@/lib/destinations";
import { getListings, ListingCard } from "@/components/catalog";

type Props = { params: Promise<{ slug: string }> };

export default async function DestinationDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const { data: county } = await db
    .from("County")
    .select("id, name, slug, isLive")
    .eq("slug", guide.countySlug)
    .eq("isLive", true)
    .maybeSingle();
  if (!county) notFound();

  const listings = await getListings(undefined, {
    county: guide.countySlug,
  });
  const shown = listings.slice(0, 8);

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line/60 bg-lake text-sand">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 20% 20%, rgba(232,196,106,0.45), transparent 55%), radial-gradient(ellipse at 80% 60%, rgba(255,255,255,0.12), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href="/destinations"
            className="text-sm text-sand/70 underline hover:text-sun-soft"
          >
            ← Destinations
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-sand/60">
            {county.name as string}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
            {guide.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-sand/85 sm:text-lg">
            {guide.headline}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-sand/70">
            {guide.blurb}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/browse?county=${guide.countySlug}`}
              className="rounded-lg bg-sun px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Browse {guide.title}
            </Link>
            <Link
              href={`/browse?county=${guide.countySlug}&category=stays`}
              className="rounded-lg border border-sand/30 px-4 py-2.5 text-sm font-medium text-sand transition hover:border-sun-soft"
            >
              Stays
            </Link>
            <Link
              href={`/browse?county=${guide.countySlug}&category=explore`}
              className="rounded-lg border border-sand/30 px-4 py-2.5 text-sm font-medium text-sand transition hover:border-sun-soft"
            >
              Experiences
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Weather &amp; season
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-medium text-ink">Best time: </span>
              {guide.bestSeason}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {guide.weatherNote}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Travel safety
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {guide.safetyTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-sun"
                  />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Highlights
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {guide.highlights.join(" · ")}
            </p>
          </section>
        </div>

        <aside className="h-fit border border-line/80 bg-white/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Emergency
          </p>
          <p className="mt-2 text-sm text-ink">
            Kenya emergency numbers: <strong>999</strong> / <strong>112</strong>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Share your booking confirmation with a companion. Keep host contact
            details handy when offline.
          </p>
        </aside>
      </div>

      <div className="border-t border-line/60 bg-white/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-lake">
              Places in {guide.title}
            </h2>
            <Link
              href={`/browse?county=${guide.countySlug}`}
              className="text-sm text-lake-bright underline"
            >
              See all
            </Link>
          </div>
          {shown.length > 0 ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              No published listings here yet.{" "}
              <Link href="/browse" className="text-lake-bright underline">
                Browse Kenya
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
