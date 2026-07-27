"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TrendPoint = {
  date: string;
  label: string;
  bookings: number;
  revenue: number;
};

type RecentListing = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  providerName: string;
  countyName: string;
};

type Overview = {
  stats: {
    users: number;
    providers: number;
    listings: number;
    bookings: number;
    revenue: number;
  };
  bookingsTrend: TrendPoint[];
  recentListings: RecentListing[];
  pendingListings: { id: string }[];
  pendingProviders: { id: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sand text-ink",
  PENDING_REVIEW: "bg-sun/20 text-ink",
  PUBLISHED: "bg-lake text-sand",
  SUSPENDED: "bg-red-100 text-red-800",
};

function label(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

const PREVIEW_COUNT = 3;

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listingsExpanded, setListingsExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview");
      const o = await res.json();
      if (!res.ok) {
        setError(o.error || "Failed to load overview");
        return;
      }
      setError(null);
      setData(o);
    } catch {
      setError("Network error — could not reach the server");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="px-4 py-12 sm:px-8">
        <div className="border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-md bg-lake px-3 py-1.5 text-sm text-sand"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-12 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse border border-line bg-white/60"
            />
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">Loading dashboard…</p>
      </div>
    );
  }

  const s = data.stats;
  const pendingProviders = data.pendingProviders?.length ?? 0;
  const pendingListings = data.pendingListings?.length ?? 0;
  const pendingTotal = pendingProviders + pendingListings;
  const trend = data.bookingsTrend ?? [];
  const listings = data.recentListings ?? [];

  const maxBookings = Math.max(1, ...trend.map((p) => p.bookings));
  const periodBookings = trend.reduce((acc, p) => acc + p.bookings, 0);
  const periodRevenue = trend.reduce((acc, p) => acc + p.revenue, 0);

  const stats: { label: string; value: string; href: string; hint: string }[] = [
    { label: "Users", value: String(s.users), href: "/admin/users", hint: "Manage accounts" },
    { label: "Providers", value: String(s.providers), href: "/admin/users?role=PROVIDER", hint: "View providers" },
    { label: "Listings", value: String(s.listings), href: "/admin/listings", hint: "Catalog" },
    { label: "Bookings", value: String(s.bookings), href: "/admin/bookings", hint: "All bookings" },
    {
      label: "Revenue",
      value: `KES ${(s.revenue || 0).toLocaleString()}`,
      href: "/admin/bookings",
      hint: "Paid bookings",
    },
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            A snapshot of everything happening across Safari Hub.
          </p>
        </div>
        {pendingTotal > 0 && (
          <Link
            href="/admin/approvals"
            className="inline-flex items-center gap-2 rounded-lg bg-sun/20 px-3 py-2 text-sm font-medium text-ink transition hover:bg-sun/30"
          >
            <span className="grid size-5 place-items-center rounded-full bg-sun text-xs font-semibold text-ink">
              {pendingTotal}
            </span>
            waiting for review →
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group admin-card block rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:border-lake-bright hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wider text-ink-muted">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-medium text-lake-bright opacity-0 transition group-hover:opacity-100">
              {stat.hint} →
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* Chart */}
        <div className="admin-card rounded-xl p-5 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              Bookings · last 14 days
            </h2>
            <p className="text-sm text-ink-muted">
              {periodBookings} booking{periodBookings === 1 ? "" : "s"} · KES{" "}
              {periodRevenue.toLocaleString()}
            </p>
          </div>
          <div className="mt-5 flex h-44 items-end gap-1.5">
            {trend.map((p) => (
              <div
                key={p.date}
                className="group flex flex-1 flex-col items-center justify-end gap-1"
                title={`${p.label}: ${p.bookings} booking${p.bookings === 1 ? "" : "s"} · KES ${p.revenue.toLocaleString()}`}
              >
                <span className="text-[0.6rem] font-medium text-ink-muted opacity-0 transition group-hover:opacity-100">
                  {p.bookings}
                </span>
                <div
                  className="w-full rounded-t bg-sun/80 transition-all group-hover:bg-sun"
                  style={{
                    height: `${Math.max(2, (p.bookings / maxBookings) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {trend.map((p, i) => (
              <span
                key={p.date}
                className="flex-1 text-center text-[0.6rem] text-ink-muted"
              >
                {i % 2 === 0 ? p.label : ""}
              </span>
            ))}
          </div>
        </div>

        {/* Recent listings */}
        <div className="admin-card rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">
              Recent listings
            </h2>
            <Link
              href="/admin/listings"
              className="text-xs font-medium text-lake-bright hover:text-lake"
            >
              View all →
            </Link>
          </div>
          {listings.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No listings yet.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {(listingsExpanded
                  ? listings
                  : listings.slice(0, PREVIEW_COUNT)
                ).map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/admin/listings/${l.id}`}
                      className="block text-sm transition hover:opacity-80"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[0.65rem] font-medium capitalize ${
                            STATUS_STYLE[l.status] || "bg-sand text-ink"
                          }`}
                        >
                          {label(l.status)}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {daysAgo(l.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 leading-snug font-medium">{l.title}</p>
                      <p className="text-xs text-ink-muted">
                        {l.providerName} · {l.countyName} · {label(l.category)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              {listings.length > PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setListingsExpanded((v) => !v)}
                  className="mt-3 text-xs font-medium text-lake-bright hover:text-lake"
                >
                  {listingsExpanded
                    ? "Show less"
                    : `Show ${listings.length - PREVIEW_COUNT} more`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Review queue summary — actions live on the Approvals page */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/approvals"
          className="group admin-card rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-lake-bright hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Providers awaiting approval
          </p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {pendingProviders}
          </p>
          <p className="mt-1 text-xs font-medium text-lake-bright opacity-0 transition group-hover:opacity-100">
            Go to approvals →
          </p>
        </Link>
        <Link
          href="/admin/approvals"
          className="group admin-card rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-lake-bright hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Listings pending review
          </p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {pendingListings}
          </p>
          <p className="mt-1 text-xs font-medium text-lake-bright opacity-0 transition group-hover:opacity-100">
            Go to approvals →
          </p>
        </Link>
      </div>
    </div>
  );
}
