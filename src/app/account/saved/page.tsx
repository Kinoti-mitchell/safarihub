"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { publicListingPath } from "@/lib/listing-paths";

type Favorite = {
  id: string;
  listingId: string;
  listing?: {
    id: string;
    title: string;
    slug: string;
    status: string;
    media?: Array<{ url: string; isCover?: boolean }>;
    county?: { name: string } | null;
    town?: { name: string } | null;
    roomTypes?: Array<{ basePrice: number }>;
  } | null;
};

export default function SavedListingsPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to load saved listings");
      else {
        setError(null);
        setFavorites(data.favorites || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(listingId: string) {
    const res = await fetch(`/api/favorites?listingId=${listingId}`, {
      method: "DELETE",
    });
    if (res.ok) void load();
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">Saved</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Listings you saved to book later.
      </p>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : favorites.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-ink-muted">
          Nothing saved yet.{" "}
          <Link href="/browse" className="text-lake-bright underline">
            Browse stays
          </Link>{" "}
          and tap the heart on a listing.
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((f) => {
            const l = f.listing;
            if (!l) return null;
            const cover =
              l.media?.find((m) => m.isCover)?.url || l.media?.[0]?.url;
            const price = l.roomTypes?.[0]?.basePrice;
            return (
              <li
                key={f.id}
                className="overflow-hidden rounded-xl border border-line bg-white/70"
              >
                <Link href={publicListingPath(l)}>
                  <div className="aspect-[4/3] bg-sand-deep">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={l.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-display font-semibold text-lake">
                      {l.title}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {[l.county?.name, l.town?.name].filter(Boolean).join(" · ")}
                    </p>
                    {price != null && (
                      <p className="mt-1 text-sm font-medium">
                        from KES {price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="border-t border-line px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void remove(l.id)}
                    className="text-sm text-ink-muted underline hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
