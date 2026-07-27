"use client";

import { useCallback, useEffect, useState } from "react";

type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  listingTitle: string;
  travelerName: string | null;
  travelerEmail: string;
  createdAt: string;
};

type Toast = { id: number; message: string; tone: "success" | "error" };

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (rating) params.set("rating", String(rating));
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load reviews");
        return;
      }
      setError(null);
      setReviews(body.reviews || []);
      setTotal(body.total || 0);
      setAvgRating(body.avgRating || 0);
    } catch {
      setError("Network error — could not load reviews");
    } finally {
      setLoading(false);
    }
  }, [query, rating]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(review: AdminReview) {
    if (
      !window.confirm(
        "Remove this review permanently? This cannot be undone.",
      )
    ) {
      return;
    }
    setBusyId(review.id);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not remove review", "error");
        return;
      }
      pushToast("Review removed", "success");
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setBusyId(null);
    }
  }

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

      <h1 className="font-display text-3xl font-semibold text-lake">Reviews</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {total} review{total === 1 ? "" : "s"}
        {avgRating > 0 && ` · ${avgRating.toFixed(2)}★ average`}. Remove reviews
        that break the guidelines.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRating("")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            rating === ""
              ? "border-lake bg-lake text-sand"
              : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          All ratings
        </button>
        {[5, 4, 3, 2, 1].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRating(r)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              rating === r
                ? "border-lake bg-lake text-sand"
                : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {r}★
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by comment, listing or guest…"
        className="mt-4 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm"
      />

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          No reviews match your filters.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sun" title={`${r.rating} out of 5`}>
                    {stars(r.rating)}
                  </span>
                  <span className="rounded bg-sand px-1.5 py-0.5 text-xs text-ink-muted">
                    {r.listingTitle}
                  </span>
                </div>
                {r.comment ? (
                  <p className="mt-1.5">{r.comment}</p>
                ) : (
                  <p className="mt-1.5 italic text-ink-muted">No comment</p>
                )}
                {r.reply && (
                  <p className="mt-1.5 border-l-2 border-lake/30 pl-2 text-ink-muted">
                    <span className="font-medium text-ink">Provider reply:</span>{" "}
                    {r.reply}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  {r.travelerName || r.travelerEmail} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => void remove(r)}
                className="shrink-0 rounded-md border border-line px-3 py-1 text-xs text-red-700 transition hover:border-red-300 disabled:opacity-50"
              >
                {busyId === r.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
