"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AdminListing = {
  id: string;
  title: string;
  category: string;
  status: string;
  featured: boolean;
  isPromoted: boolean;
  providerName: string;
  countyName: string;
  photoCount: number;
  fromPrice: number | null;
  reviewCount: number;
  bookingCount: number;
  createdAt: string;
};

const STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "SUSPENDED"] as const;
const CATEGORIES = ["STAY", "EAT", "MOVE", "EXPLORE", "MEET"] as const;

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sand text-ink-muted",
  PENDING_REVIEW: "bg-sun/20 text-ink",
  PUBLISHED: "bg-lake text-sand",
  SUSPENDED: "bg-red-100 text-red-700",
};

function label(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default function AdminListingsPage() {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (category) params.set("category", category);
      const res = await fetch(`/api/admin/listings?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load listings");
        return;
      }
      setError(null);
      setListings(body.listings || []);
      setTotal(body.total || 0);
    } catch {
      setError("Network error — could not load listings");
    } finally {
      setLoading(false);
    }
  }, [query, status, category]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">Listings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {total} listing{total === 1 ? "" : "s"}. Open a listing to review,
        publish, suspend, feature, or promote.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            status === ""
              ? "border-lake bg-lake text-sand"
              : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          All statuses
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
              status === s
                ? "border-lake bg-lake text-sand"
                : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {label(s)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, provider or county…"
          className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm"
        />
      </div>

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading listings…</p>
      ) : listings.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          No listings match your filters.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {listings.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/listings/${l.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white/70 px-4 py-3 transition hover:border-lake-bright hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{l.title}</p>
                    {l.featured && (
                      <span className="rounded-full bg-lake/10 px-2 py-0.5 text-xs text-lake">
                        Featured
                      </span>
                    )}
                    {l.isPromoted && (
                      <span className="rounded-full bg-sun/25 px-2 py-0.5 text-xs text-ink">
                        Promoted
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {l.providerName} · {l.countyName} · {label(l.category)} ·{" "}
                    {l.photoCount} photo{l.photoCount === 1 ? "" : "s"}
                    {l.fromPrice != null
                      ? ` · from KES ${l.fromPrice.toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      STATUS_STYLE[l.status] || "bg-sand text-ink"
                    }`}
                  >
                    {label(l.status)}
                  </span>
                  <span className="text-sm font-medium text-lake-bright">
                    Open →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
