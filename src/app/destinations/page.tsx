import Link from "next/link";
import { db } from "@/lib/supabase";
import { DESTINATION_GUIDES } from "@/lib/destinations";
import { brandFromSettings } from "@/lib/branding";

export default async function DestinationsPage() {
  const brand = await brandFromSettings();
  const { data: counties } = await db
    .from("County")
    .select("id, name, slug, isLive")
    .eq("isLive", true);

  const bySlug = new Map(
    (counties ?? []).map((c) => [c.slug as string, c]),
  );

  const hubs = DESTINATION_GUIDES.filter((g) => bySlug.has(g.countySlug)).map(
    (g) => ({
      ...g,
      county: bySlug.get(g.countySlug)!,
    }),
  );

  return (
    <div>
      <div className="border-b border-line/60 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            Destinations
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted sm:text-base">
            Where to stay, eat, and explore across {brand.marketName} — season
            tips and safety notes for first-time visitors.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {hubs.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hubs.map((h) => (
              <Link
                key={h.slug}
                href={`/destinations/${h.slug}`}
                className="group block border border-line/80 bg-white/70 p-5 transition hover:border-lake-bright"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  {h.county.name as string}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-ink group-hover:text-lake">
                  {h.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {h.headline}
                </p>
                <p className="mt-3 text-xs text-lake-bright">Explore →</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            Destination guides will appear when counties are live.{" "}
            <Link href="/browse" className="text-lake-bright underline">
              Browse listings
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
