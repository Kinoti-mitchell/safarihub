"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type CatalogMapPin = {
  id: string;
  title: string;
  href: string;
  latitude: number;
  longitude: number;
  priceLabel?: string | null;
};

export function CatalogBrowseView({
  pins,
  grid,
  page,
  pageSize,
  total,
}: {
  pins: CatalogMapPin[];
  grid: React.ReactNode;
  page: number;
  pageSize: number;
  total: number;
}) {
  const [view, setView] = useState<"grid" | "map">("grid");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bounds = useMemo(() => {
    if (!pins.length) return null;
    const lats = pins.map((p) => p.latitude);
    const lngs = pins.map((p) => p.longitude);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [pins]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line bg-white/70 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`rounded-md px-3 py-1.5 font-medium ${
              view === "grid" ? "bg-lake text-sand" : "text-ink-muted"
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            className={`rounded-md px-3 py-1.5 font-medium ${
              view === "map" ? "bg-lake text-sand" : "text-ink-muted"
            }`}
          >
            Map
          </button>
        </div>
        <Link
          href="/trip"
          className="text-sm font-semibold text-lake-bright underline underline-offset-2"
        >
          Build a trip →
        </Link>
      </div>

      {view === "grid" ? (
        <div className="mt-6">{grid}</div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <div className="overflow-hidden rounded-xl border border-line bg-white/70 lg:col-span-3">
            {bounds ? (
              <iframe
                title="Listings map"
                className="h-80 w-full lg:h-[28rem]"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bounds.minLng - 0.15}%2C${bounds.minLat - 0.1}%2C${bounds.maxLng + 0.15}%2C${bounds.maxLat + 0.1}&layer=mapnik`}
              />
            ) : (
              <p className="grid h-80 place-items-center text-sm text-ink-muted">
                No map pins for these results — try another filter.
              </p>
            )}
          </div>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto lg:col-span-2">
            {pins.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.href}
                  className="block rounded-lg border border-line bg-white/70 px-3 py-2.5 transition hover:border-lake-bright"
                >
                  <p className="text-sm font-medium text-ink">{p.title}</p>
                  {p.priceLabel && (
                    <p className="text-xs text-ink-muted">{p.priceLabel}</p>
                  )}
                </Link>
              </li>
            ))}
            {!pins.length && (
              <li className="py-8 text-center text-sm text-ink-muted">
                No pinned listings in this page of results.
              </li>
            )}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-sm text-ink-muted">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
            className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
