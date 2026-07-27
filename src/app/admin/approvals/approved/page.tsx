"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ListingOffer = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  quantity: number;
  maxGuests: number;
};

type ListingPhoto = {
  id: string;
  url: string;
  isCover: boolean;
};

type ApprovedListing = {
  id: string;
  title: string;
  category: string;
  status: string;
  featured: boolean;
  isPromoted: boolean;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  acceptMpesa: boolean;
  acceptCard: boolean;
  acceptCashOnArrival: boolean;
  amenities: string[];
  county: { name: string } | null;
  town: { name: string } | null;
  photoCount: number;
  coverUrl: string | null;
  photos: ListingPhoto[];
  offerCount: number;
  fromPrice: number | null;
  offers: ListingOffer[];
  approvedAt: string;
  createdAt: string;
};

type ApprovedBusiness = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commissionRate: number;
  approvedAt: string;
  listingCount: number;
  publishedCount: number;
  listings: ApprovedListing[];
};

type ApprovedOwner = {
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  approvedAt: string;
  businessCount: number;
  listingCount: number;
  publishedCount: number;
  businesses: ApprovedBusiness[];
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sand text-ink-muted",
  PENDING_REVIEW: "bg-sun/20 text-ink",
  PUBLISHED: "bg-lake text-sand",
  SUSPENDED: "bg-red-100 text-red-700",
};

function daysAgoOrDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function label(v: string) {
  return v.toLowerCase().replace(/_/g, " ");
}

function mapSrc(l: ApprovedListing): string | null {
  if (l.latitude != null && l.longitude != null) {
    return `https://www.google.com/maps?q=${l.latitude},${l.longitude}&z=15&output=embed`;
  }
  const q = [l.address, l.town?.name, l.county?.name]
    .filter(Boolean)
    .join(", ");
  if (!q) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=13&output=embed`;
}

function mapLink(l: ApprovedListing): string {
  if (l.latitude != null && l.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [l.address, l.town?.name, l.county?.name].filter(Boolean).join(", "),
  )}`;
}

export default function AdminApprovedPage() {
  const [owners, setOwners] = useState<ApprovedOwner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openOwnerId, setOpenOwnerId] = useState<string | null>(null);
  const [openBusinessId, setOpenBusinessId] = useState<string | null>(null);
  const [openListingId, setOpenListingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/approvals");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load history");
        return;
      }
      setError(null);
      setOwners(body.approvedOwners || []);
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="px-4 py-10 sm:px-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lake">
          Approved
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Approved owners — click one to see businesses, then open a listing for
          map, photos, offers and details.
        </p>
      </div>

      {error && (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-md bg-lake px-3 py-1.5 text-sm text-sand"
          >
            Retry
          </button>
        </div>
      )}

      {!loaded && !error && (
        <p className="mt-6 text-sm text-ink-muted">Loading history…</p>
      )}

      {loaded && !error && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            Approved owners
            <span className="ml-2 rounded-full bg-lake/10 px-2 py-0.5 text-xs text-lake">
              {owners.length}
            </span>
          </h2>

          {owners.length === 0 ? (
            <div className="mt-3 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
              No approved owners yet.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {owners.map((o) => {
                const isOpen = openOwnerId === o.ownerId;
                return (
                  <li
                    key={o.ownerId}
                    className="overflow-hidden rounded-lg border border-line bg-white/70"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenOwnerId((cur) =>
                          cur === o.ownerId ? null : o.ownerId,
                        );
                        setOpenBusinessId(null);
                        setOpenListingId(null);
                      }}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-sand/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{o.ownerName}</p>
                        <p className="text-sm text-ink-muted">
                          {o.ownerEmail || "No email"}
                          {o.ownerPhone ? ` · ${o.ownerPhone}` : ""} ·{" "}
                          {o.businessCount} business
                          {o.businessCount === 1 ? "" : "es"} ·{" "}
                          {o.publishedCount} live / {o.listingCount} listings
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-lake/10 px-2 py-0.5 text-xs font-medium text-lake">
                          approved {daysAgoOrDate(o.approvedAt)}
                        </span>
                        <span className="text-sm text-ink-muted" aria-hidden>
                          {isOpen ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-line bg-sand/20 px-3 py-3 sm:px-4">
                        {o.businesses.map((b) => {
                          const bizOpen = openBusinessId === b.id;
                          return (
                            <div
                              key={b.id}
                              className="overflow-hidden rounded-lg border border-line bg-white/80"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenBusinessId((cur) =>
                                      cur === b.id ? null : b.id,
                                    );
                                    setOpenListingId(null);
                                  }}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="font-medium text-ink">
                                    {b.name}
                                  </p>
                                  <p className="text-xs text-ink-muted">
                                    {b.commissionRate}% commission ·{" "}
                                    {b.publishedCount} live / {b.listingCount}{" "}
                                    listings · approved{" "}
                                    {daysAgoOrDate(b.approvedAt)}
                                  </p>
                                </button>
                                <div className="flex items-center gap-3">
                                  <Link
                                    href={`/admin/providers/${b.id}`}
                                    className="text-sm font-medium text-lake-bright hover:text-lake"
                                  >
                                    Full profile →
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenBusinessId((cur) =>
                                        cur === b.id ? null : b.id,
                                      );
                                      setOpenListingId(null);
                                    }}
                                    className="text-sm text-ink-muted"
                                  >
                                    {bizOpen ? "▾" : "▸"}
                                  </button>
                                </div>
                              </div>

                              {bizOpen && (
                                <div className="border-t border-line bg-sand/10 px-3 py-3">
                                  {b.listings.length === 0 ? (
                                    <p className="py-2 text-center text-sm text-ink-muted">
                                      No listings for this business yet.
                                    </p>
                                  ) : (
                                    <ul className="space-y-3">
                                      {b.listings.map((l) => {
                                        const place = [
                                          l.town?.name,
                                          l.county?.name,
                                        ]
                                          .filter(Boolean)
                                          .join(", ");
                                        const listingOpen =
                                          openListingId === l.id;
                                        const embed = mapSrc(l);
                                        const payments = [
                                          l.acceptMpesa && "M-Pesa",
                                          l.acceptCard && "Card",
                                          l.acceptCashOnArrival && "Cash",
                                        ]
                                          .filter(Boolean)
                                          .join(", ");

                                        return (
                                          <li
                                            key={l.id}
                                            className="overflow-hidden rounded-lg border border-line bg-white"
                                          >
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setOpenListingId((cur) =>
                                                  cur === l.id ? null : l.id,
                                                )
                                              }
                                              className="flex w-full gap-3 p-3 text-left transition hover:bg-sand/30"
                                            >
                                              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-sand">
                                                {l.coverUrl ? (
                                                  // eslint-disable-next-line @next/next/no-img-element
                                                  <img
                                                    src={l.coverUrl}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                  />
                                                ) : (
                                                  <div className="flex h-full items-center justify-center text-[0.65rem] text-ink-muted">
                                                    No photo
                                                  </div>
                                                )}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <p className="font-medium text-ink">
                                                    {l.title}
                                                  </p>
                                                  <span
                                                    className={`rounded px-2 py-0.5 text-[0.65rem] capitalize ${
                                                      STATUS_STYLE[l.status] ||
                                                      "bg-sand"
                                                    }`}
                                                  >
                                                    {label(l.status)}
                                                  </span>
                                                  {l.featured && (
                                                    <span className="rounded-full bg-sun/20 px-2 py-0.5 text-[0.65rem] font-medium text-ink">
                                                      featured
                                                    </span>
                                                  )}
                                                  {l.isPromoted && (
                                                    <span className="rounded-full bg-lake/10 px-2 py-0.5 text-[0.65rem] font-medium text-lake">
                                                      boosted
                                                    </span>
                                                  )}
                                                </div>
                                                <p className="mt-0.5 text-sm text-ink-muted">
                                                  {place || "No location"} ·{" "}
                                                  {label(l.category)} ·{" "}
                                                  {l.offerCount} offer
                                                  {l.offerCount === 1
                                                    ? ""
                                                    : "s"}
                                                  {l.fromPrice != null
                                                    ? ` · from KES ${l.fromPrice.toLocaleString()}`
                                                    : ""}
                                                </p>
                                              </div>
                                              <span className="shrink-0 self-center text-sm text-ink-muted">
                                                {listingOpen
                                                  ? "Hide details ▾"
                                                  : "Details ▸"}
                                              </span>
                                            </button>

                                            {listingOpen && (
                                              <div className="space-y-4 border-t border-line px-3 py-4 sm:px-4">
                                                {l.photos?.length > 0 && (
                                                  <div>
                                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                                      Photos ({l.photoCount})
                                                    </p>
                                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                                      {l.photos.map((p) => (
                                                        <div
                                                          key={p.id}
                                                          className="h-28 w-36 shrink-0 overflow-hidden rounded-md border border-line bg-sand"
                                                        >
                                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                                          <img
                                                            src={p.url}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                          />
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                <div>
                                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                                    Description
                                                  </p>
                                                  <p className="whitespace-pre-wrap text-sm text-ink">
                                                    {l.description ||
                                                      "No description provided."}
                                                  </p>
                                                </div>

                                                <div>
                                                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                                      Location
                                                    </p>
                                                    <a
                                                      href={mapLink(l)}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="text-xs font-medium text-lake-bright hover:text-lake"
                                                    >
                                                      Open in Google Maps →
                                                    </a>
                                                  </div>
                                                  <p className="text-sm text-ink">
                                                    {l.address ||
                                                      "No street address"}
                                                    {l.locationConfirmed ? (
                                                      <span className="ml-2 rounded-full bg-lake/10 px-2 py-0.5 text-xs text-lake">
                                                        pin confirmed
                                                      </span>
                                                    ) : (
                                                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                                        pin not confirmed
                                                      </span>
                                                    )}
                                                  </p>
                                                  <p className="mt-0.5 text-xs text-ink-muted">
                                                    {place || "No county"}
                                                    {l.latitude != null &&
                                                    l.longitude != null
                                                      ? ` · ${l.latitude.toFixed(5)}, ${l.longitude.toFixed(5)}`
                                                      : " · no GPS"}
                                                  </p>
                                                  {embed ? (
                                                    <iframe
                                                      title={`${l.title} map`}
                                                      src={embed}
                                                      className="mt-2 h-56 w-full rounded-md border border-line"
                                                      loading="lazy"
                                                      referrerPolicy="no-referrer-when-downgrade"
                                                    />
                                                  ) : (
                                                    <p className="mt-2 rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-muted">
                                                      No map location set.
                                                    </p>
                                                  )}
                                                </div>

                                                <div>
                                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                                    Offers &amp; pricing (
                                                    {l.offers?.length || 0})
                                                  </p>
                                                  {!l.offers?.length ? (
                                                    <p className="text-sm text-ink-muted">
                                                      No offers set.
                                                    </p>
                                                  ) : (
                                                    <ul className="space-y-2">
                                                      {l.offers.map((offer) => (
                                                        <li
                                                          key={offer.id}
                                                          className="rounded-md border border-line bg-sand/30 px-3 py-2 text-sm"
                                                        >
                                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="font-medium">
                                                              {offer.name}
                                                            </span>
                                                            <span className="font-semibold text-lake">
                                                              KES{" "}
                                                              {offer.basePrice.toLocaleString()}
                                                            </span>
                                                          </div>
                                                          <p className="text-xs text-ink-muted">
                                                            {offer.quantity} unit
                                                            {offer.quantity ===
                                                            1
                                                              ? ""
                                                              : "s"}{" "}
                                                            · up to{" "}
                                                            {offer.maxGuests}{" "}
                                                            guest
                                                            {offer.maxGuests ===
                                                            1
                                                              ? ""
                                                              : "s"}
                                                          </p>
                                                          {offer.description && (
                                                            <p className="mt-1 text-xs text-ink-muted">
                                                              {
                                                                offer.description
                                                              }
                                                            </p>
                                                          )}
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  )}
                                                </div>

                                                {(l.amenities?.length > 0 ||
                                                  payments) && (
                                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                                                    {payments && (
                                                      <span>
                                                        Payments: {payments}
                                                      </span>
                                                    )}
                                                    {l.amenities?.length >
                                                      0 && (
                                                      <span>
                                                        Amenities:{" "}
                                                        {l.amenities
                                                          .slice(0, 8)
                                                          .join(", ")}
                                                        {l.amenities.length > 8
                                                          ? "…"
                                                          : ""}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}

                                                <Link
                                                  href={`/admin/listings/${l.id}?from=approved`}
                                                  className="inline-flex rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand transition hover:bg-lake-bright"
                                                >
                                                  Open full review (feature /
                                                  promote / suspend) →
                                                </Link>
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
