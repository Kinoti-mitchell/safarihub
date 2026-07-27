"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_LABELS,
  type ListingCategoryKey,
} from "@/lib/amenities";

type Listing = {
  id: string;
  title: string;
  status: string;
  category: string;
  categories?: string[];
  listingKinds?: string[];
  venueTypes?: string[];
  amenities?: string[];
  county?: { name: string };
  town?: { name: string };
  roomTypes: { id: string; name: string; quantity: number; basePrice: number }[];
};

function listingLabels(listing: Listing): string {
  const cats =
    Array.isArray(listing.categories) && listing.categories.length
      ? listing.categories
      : [listing.category];
  const catText = cats
    .map((c) => CATEGORY_LABELS[c as ListingCategoryKey]?.split(" (")[0] || c)
    .join(" · ");
  const types =
    Array.isArray(listing.amenities) && listing.amenities.length
      ? ` · ${listing.amenities.slice(0, 3).join(", ")}${listing.amenities.length > 3 ? "…" : ""}`
      : Array.isArray(listing.venueTypes) && listing.venueTypes.length
        ? ` · ${listing.venueTypes.join(", ")}`
        : "";
  return catText + types;
}

export default function ProviderListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [provider, setProvider] = useState<{
    name: string;
    slug: string;
    isApproved: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const l = await fetch("/api/listings?mine=true").then((r) => r.json());
      const rows = l.listings || [];
      setListings(rows);
      if (l.provider) setProvider(l.provider);
      setLoading(false);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.has("welcome") && l.provider?.isApproved !== false) {
          router.replace("/provider/listings/new");
        }
      }
    })();
  }, [router]);

  const canCreate = provider?.isApproved !== false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Listings
          </h1>
          {provider ? (
            <p className="mt-2 text-sm text-ink">
              <span className="font-semibold">{provider.name}</span>
              <span className="text-ink-muted">
                {provider.isApproved
                  ? " · approved"
                  : " · awaiting approval — listing is locked until admin confirms"}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              Create a listing, then add photos and prices.
            </p>
          )}
        </div>
        {canCreate && (
          <Link
            href="/provider/listings/new"
            className="shrink-0 rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright"
          >
            + New listing
          </Link>
        )}
      </div>

      {provider && !provider.isApproved && (
        <div className="mt-6 rounded-lg border border-sun/40 bg-sun/10 p-4 text-sm text-ink">
          Your business is still under review. Once an admin approves you, you
          can create and publish listings here.
        </div>
      )}

      <div className="mt-10 space-y-3">
        {loading && <p className="text-sm text-ink-muted">Loading…</p>}
        {!loading && listings.length === 0 && (
          <div className="border border-line bg-white/70 p-6 text-center">
            <p className="text-sm text-ink-muted">
              No listings yet for {provider?.name || "your business"}.
            </p>
            {canCreate && (
              <Link
                href="/provider/listings/new"
                className="mt-3 inline-flex rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand"
              >
                + New listing
              </Link>
            )}
          </div>
        )}
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/provider/listings/${listing.id}`}
            className="flex items-center justify-between gap-4 border border-line bg-white/70 p-4 transition hover:border-lake-bright"
          >
            <div>
              <p className="font-display text-lg font-semibold">
                {listing.title}
              </p>
              <p className="text-sm text-ink-muted">
                {listingLabels(listing)} ·{" "}
                {listing.town?.name || listing.county?.name} · {listing.status}
              </p>
            </div>
            <p className="text-sm text-ink-muted">
              {listing.roomTypes.length} offer
              {listing.roomTypes.length === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
