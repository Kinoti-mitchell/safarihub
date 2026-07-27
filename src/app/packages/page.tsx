import Link from "next/link";
import { db } from "@/lib/supabase";
import { brandFromSettings } from "@/lib/branding";
import { formatPriceTourist } from "@/lib/currency";

export default async function PackagesPage() {
  const brand = await brandFromSettings();
  let packages: Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    price: number;
    days: number;
    items: Array<{ id: string; label: string; details: string | null }> | null;
  }> = [];
  try {
    const { data, error } = await db
      .from("TravelPackage")
      .select("*, items:PackageItem(*)")
      .eq("isPublished", true)
      .order("createdAt", { ascending: false });
    if (error) throw error;
    packages = (data ?? []) as typeof packages;
  } catch {
    packages = [];
  }

  return (
    <div>
      <div className="border-b border-line/60 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            Packages
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted sm:text-base">
            Bundled stays, transfers and experiences — book as a guest or member
            in one checkout.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {packages.length > 0 ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {packages.map((p) => {
              const price = formatPriceTourist(p.price, brand.currency);
              return (
                <article
                  key={p.id}
                  className="flex flex-col border border-line/80 bg-white/70 p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-xl font-semibold text-ink">
                      {p.title}
                    </h2>
                    <p className="font-display text-lg font-semibold text-lake">
                      {price.primary}
                      {price.approx ? (
                        <span className="ml-1 text-sm font-normal text-ink-muted">
                          {price.approx}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {p.days} day{p.days === 1 ? "" : "s"} · includes below
                  </p>
                  {p.description && (
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                      {p.description}
                    </p>
                  )}
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-ink">
                    {p.items?.map((i) => (
                      <li key={i.id} className="flex gap-2">
                        <span
                          aria-hidden
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-sun"
                        />
                        <span>
                          {i.label}
                          {i.details ? (
                            <span className="text-ink-muted">
                              {" "}
                              — {i.details}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <Link
                      href={`/packages/${p.slug || p.id}`}
                      className="inline-flex rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand transition hover:bg-lake-bright"
                    >
                      View &amp; book
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-line/80 bg-white/60 px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              No packages published yet
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Build your own trip from stays, move and explore listings.
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-flex rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand"
            >
              Browse Kenya
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
