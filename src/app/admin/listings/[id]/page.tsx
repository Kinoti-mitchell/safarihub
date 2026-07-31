"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  FEATURE_PERIODS,
  featurePeriodLabel,
  type FeaturePeriod,
} from "@/lib/featured-shared";

type Media = { id: string; url: string; alt: string | null; isCover: boolean };
type RoomType = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  basePrice: number;
  maxGuests: number;
  amenities: unknown;
};
type Provider = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isApproved: boolean;
  commissionRate: number;
};
type Listing = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  featured: boolean;
  featuredAt?: string | null;
  featuredEndsAt?: string | null;
  isPromoted: boolean;
  boostEndsAt?: string | null;
  publishFeeKes?: number | null;
  publishPaymentRef?: string | null;
  publishPaymentNote?: string | null;
  publishPaymentStatus?: string | null;
  acceptMpesa: boolean;
  acceptCard: boolean;
  acceptCashOnArrival: boolean;
  createdAt: string;
  updatedAt: string;
  provider: Provider | null;
  county: { name: string } | null;
  town: { name: string } | null;
  media: Media[];
  roomTypes: RoomType[];
  _count: { reviews: number; bookings: number };
};
type HistoryEntry = {
  id: string;
  action: string;
  summary: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};
type Toast = { id: number; message: string; tone: "success" | "error" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sand text-ink-muted",
  PENDING_REVIEW: "bg-sun/20 text-ink",
  PUBLISHED: "bg-lake text-sand",
  SUSPENDED: "bg-red-100 text-red-700",
};

function label(v: string): string {
  return v.toLowerCase().replace(/_/g, " ");
}

function amenityList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

export default function AdminListingDetailPage() {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-10 text-sm text-ink-muted sm:px-8">
          Loading listing…
        </p>
      }
    >
      <AdminListingDetailInner />
    </Suspense>
  );
}

function AdminListingDetailInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const providerIdParam = searchParams.get("providerId");

  const back =
    from === "approved"
      ? { href: "/admin/approvals/approved", label: "← Back to approved" }
      : from === "pending"
        ? { href: "/admin/approvals", label: "← Back to pending approvals" }
        : from === "provider" && providerIdParam
          ? {
              href: `/admin/providers/${providerIdParam}`,
              label: "← Back to provider",
            }
          : { href: "/admin/listings", label: "← Back to listings" };

  const [listing, setListing] = useState<Listing | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [featurePeriod, setFeaturePeriod] = useState<FeaturePeriod>("WEEKLY");

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const tid = Date.now() + Math.random();
    setToasts((t) => [...t, { id: tid, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/listings/${id}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load listing");
        return;
      }
      setError(null);
      setListing(body.listing);
      setHistory(body.history || []);
    } catch {
      setError("Network error — could not load listing");
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    data: Record<string, unknown>,
    message: string,
    requireComment: boolean,
  ) {
    if (requireComment && !comment.trim()) {
      pushToast("Add a comment explaining your decision first", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, comment: comment.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not update listing", "error");
        return;
      }
      pushToast(message, "success");
      setComment("");
      await load();
      router.refresh();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setBusy(false);
    }
  }

  const mapSrc = listing
    ? listing.latitude != null && listing.longitude != null
      ? `https://www.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`
      : listing.address || listing.county
        ? `https://www.google.com/maps?q=${encodeURIComponent(
            [listing.address, listing.town?.name, listing.county?.name]
              .filter(Boolean)
              .join(", "),
          )}&z=13&output=embed`
        : null
    : null;
  const mapLink = listing
    ? listing.latitude != null && listing.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [listing.address, listing.town?.name, listing.county?.name]
            .filter(Boolean)
            .join(", "),
        )}`
    : "#";

  return (
    <div className="px-4 py-10 sm:px-8">
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md px-4 py-2 text-sm shadow-lg ${
              t.tone === "success" ? "bg-lake text-sand" : "bg-red-600 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <Link
        href={back.href}
        className="text-sm font-medium text-lake-bright hover:text-lake"
      >
        {back.label}
      </Link>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 p-4 text-red-700">
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
        <p className="mt-6 text-sm text-ink-muted">Loading listing…</p>
      )}

      {loaded && !error && listing && (
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* Main column */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold text-lake">
                  {listing.title}
                </h1>
                <p className="mt-1 text-sm capitalize text-ink-muted">
                  {listing.category.toLowerCase()} ·{" "}
                  {listing.town?.name ? `${listing.town.name}, ` : ""}
                  {listing.county?.name || "No county"} · added{" "}
                  {new Date(listing.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  STATUS_STYLE[listing.status] || "bg-sand text-ink"
                }`}
              >
                {label(listing.status)}
              </span>
            </div>

            {/* Gallery */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Photos ({listing.media.length})
              </h2>
              {listing.media.length === 0 ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-8 text-center text-sm text-amber-700">
                  No photos uploaded — the provider has not added any images.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {listing.media.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLightbox(m.url)}
                      className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-sand"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt={m.alt || listing.title}
                        className="size-full object-cover transition group-hover:scale-105"
                      />
                      {m.isCover && (
                        <span className="absolute left-2 top-2 rounded-full bg-lake px-2 py-0.5 text-[0.65rem] font-medium text-sand">
                          cover
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Description */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Description
              </h2>
              <p className="whitespace-pre-wrap rounded-lg border border-line bg-white/70 p-4 text-sm text-ink">
                {listing.description || "No description provided."}
              </p>
            </section>

            {/* Location */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Location
              </h2>
              <div className="rounded-lg border border-line bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-ink">
                    {listing.address || "No street address"}
                    {listing.locationConfirmed ? (
                      <span className="ml-2 rounded-full bg-lake/10 px-2 py-0.5 text-xs text-lake">
                        pin confirmed
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        pin not confirmed
                      </span>
                    )}
                  </p>
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-lake-bright hover:text-lake"
                  >
                    Open in Google Maps →
                  </a>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {listing.latitude != null && listing.longitude != null
                    ? `${listing.latitude.toFixed(5)}, ${listing.longitude.toFixed(5)}`
                    : "No GPS coordinates set"}
                </p>
                {mapSrc && (
                  <iframe
                    title="Listing location"
                    src={mapSrc}
                    className="mt-3 h-64 w-full rounded-md border border-line"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </div>
            </section>

            {/* Rooms / pricing */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Rooms & pricing ({listing.roomTypes.length})
              </h2>
              {listing.roomTypes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
                  No room types or prices set.
                </div>
              ) : (
                <ul className="space-y-2">
                  {listing.roomTypes.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-line bg-white/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-sm font-semibold text-lake">
                          KES {r.basePrice.toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {r.quantity} unit{r.quantity === 1 ? "" : "s"} · up to{" "}
                        {r.maxGuests} guest{r.maxGuests === 1 ? "" : "s"}
                      </p>
                      {r.description && (
                        <p className="mt-1 text-sm text-ink-muted">{r.description}</p>
                      )}
                      {amenityList(r.amenities).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {amenityList(r.amenities).map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-muted"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Moderation history */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Moderation history
              </h2>
              {history.length === 0 ? (
                <p className="rounded-lg border border-line bg-white/70 p-4 text-sm text-ink-muted">
                  No actions recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-lg border border-line bg-white/70 p-3 text-sm"
                    >
                      <p className="text-ink">{h.summary}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {h.actorName || h.actorEmail || "System"} ·{" "}
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Sidebar: provider, facts, actions */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-line bg-white/70 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Provider
              </h2>
              <p className="mt-2 font-medium">{listing.provider?.name || "—"}</p>
              <p className="text-sm text-ink-muted">
                {listing.provider?.email || "No email"}
              </p>
              <p className="text-sm text-ink-muted">
                {listing.provider?.phone || "No phone"}
              </p>
              <p className="mt-2 text-xs">
                {listing.provider?.isApproved ? (
                  <span className="rounded-full bg-lake/10 px-2 py-0.5 text-lake">
                    approved provider
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    provider not approved
                  </span>
                )}
                <span className="ml-2 text-ink-muted">
                  {listing.provider?.commissionRate}% commission
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-line bg-white/70 p-4 text-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                At a glance
              </h2>
              <dl className="mt-2 space-y-1.5">
                <Row k="Bookings" v={String(listing._count.bookings)} />
                <Row k="Reviews" v={String(listing._count.reviews)} />
                <Row
                  k="Payment"
                  v={
                    [
                      listing.acceptMpesa && "M-Pesa",
                      listing.acceptCard && "Card",
                      listing.acceptCashOnArrival && "Cash",
                    ]
                      .filter(Boolean)
                      .join(", ") || "None"
                  }
                />
                <Row
                  k="Featured"
                  v={
                    listing.featured
                      ? listing.featuredEndsAt
                        ? `Yes · until ${new Date(listing.featuredEndsAt).toLocaleString("en-KE")}`
                        : "Yes"
                      : "No"
                  }
                />
                <Row
                  k="Boosted"
                  v={
                    listing.isPromoted
                      ? listing.boostEndsAt
                        ? `Yes · until ${new Date(listing.boostEndsAt).toLocaleString("en-KE")}`
                        : "Yes"
                      : "No"
                  }
                />
              </dl>
            </div>

            {/* Review actions */}
            <div className="rounded-xl border border-line bg-white/70 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Publish payment &amp; actions
              </h2>
              {(listing.publishPaymentRef ||
                listing.publishFeeKes != null ||
                listing.publishPaymentStatus) && (
                <div className="mt-2 rounded-md border border-line bg-sand/30 px-3 py-2 text-sm">
                  {listing.publishFeeKes != null && (
                    <p>
                      Fee:{" "}
                      <span className="font-medium">
                        KES {Number(listing.publishFeeKes).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {listing.publishPaymentRef && (
                    <p className="mt-1 font-mono">
                      Ref: {listing.publishPaymentRef}
                    </p>
                  )}
                  {listing.publishPaymentNote && (
                    <p className="mt-1 text-ink-muted">
                      Note: {listing.publishPaymentNote}
                    </p>
                  )}
                  {listing.publishPaymentStatus && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
                      {listing.publishPaymentStatus.replace(/_/g, " ")}
                    </p>
                  )}
                </div>
              )}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add a comment (required to send back or suspend)…"
                className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
              />
              <div className="mt-3 grid gap-2">
                {listing.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { status: "PUBLISHED" },
                        `Confirmed payment & published "${listing.title}"`,
                        false,
                      )
                    }
                    className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand transition hover:bg-lake-bright disabled:opacity-50"
                  >
                    {listing.status === "PENDING_REVIEW"
                      ? "Confirm payment & go live"
                      : "Publish"}
                  </button>
                )}
                {listing.status === "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { status: "SUSPENDED" },
                        `Suspended "${listing.title}"`,
                        true,
                      )
                    }
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 disabled:opacity-50"
                  >
                    Suspend listing
                  </button>
                )}
                {listing.status === "SUSPENDED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { status: "PUBLISHED" },
                        `Re-published "${listing.title}"`,
                        false,
                      )
                    }
                    className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand transition hover:bg-lake-bright disabled:opacity-50"
                  >
                    Re-publish
                  </button>
                )}
                {listing.featured ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { featured: false },
                        `Removed "${listing.title}" from carousel`,
                        false,
                      )
                    }
                    className="rounded-lg border border-lake bg-lake/10 px-4 py-2 text-sm font-medium text-lake transition disabled:opacity-50"
                  >
                    Featured — tap to remove
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="feature-period">
                      Carousel duration
                    </label>
                    <select
                      id="feature-period"
                      value={featurePeriod}
                      onChange={(e) =>
                        setFeaturePeriod(e.target.value as FeaturePeriod)
                      }
                      disabled={busy}
                      className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                    >
                      {FEATURE_PERIODS.map((p) => (
                        <option key={p} value={p}>
                          {featurePeriodLabel(p)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          { featured: true, featurePeriod },
                          `Featured "${listing.title}" for ${featurePeriodLabel(featurePeriod)}`,
                          false,
                        )
                      }
                      className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright disabled:opacity-50"
                    >
                      Feature on carousel
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      { isPromoted: !listing.isPromoted },
                      listing.isPromoted
                        ? `Removed promotion on "${listing.title}"`
                        : `Promoted "${listing.title}"`,
                      false,
                    )
                  }
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                    listing.isPromoted
                      ? "border-sun bg-sun/20 text-ink"
                      : "border-line text-ink hover:border-lake-bright"
                  }`}
                >
                  {listing.isPromoted
                    ? "Promoted — tap to remove"
                    : "Promote listing"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      { status: "DRAFT" },
                      "Sent back for changes",
                      true,
                    )
                  }
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-amber-300 disabled:opacity-50"
                >
                  Deny / request changes
                </button>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Paid boost requests from providers are approved under{" "}
                <Link href="/admin/boost" className="underline">
                  Boosts
                </Link>
                . Promote here is an admin override.
              </p>
            </div>

            {listing.provider?.id && (
              <Link
                href={`/admin/providers/${listing.provider.id}`}
                className="block rounded-xl border border-line bg-white/70 px-4 py-3 text-sm font-medium text-lake-bright hover:text-lake"
              >
                View all listings by this provider →
              </Link>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Listing photo"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </button>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}
