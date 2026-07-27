"use client";

import { FormEvent, useEffect, useState } from "react";

export default function ProviderReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/reviews?mine=true");
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setReviews(data.reviews || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function reply(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: form.get("reply") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save reply");
        return;
      }
      e.currentTarget.reset();
      void load();
    } catch {
      setError("Network error — is the server running?");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">Reviews</h1>
      <p className="mt-2 text-ink-muted">Guest feedback on your listings.</p>
      {error && <p className="mt-4 text-red-700">{error}</p>}
      <div className="mt-8 space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="border border-line bg-white/70 p-4">
            <p className="font-semibold">
              {r.rating}/5 · {r.listing?.title}
            </p>
            <p className="text-sm text-ink-muted">{r.traveler?.name}</p>
            <p className="mt-2 text-sm">{r.comment || "No comment"}</p>
            {r.reply ? (
              <p className="mt-2 text-sm text-lake">Your reply: {r.reply}</p>
            ) : (
              <form onSubmit={(e) => void reply(e, r.id)} className="mt-3 flex gap-2">
                <input
                  name="reply"
                  required
                  placeholder="Public reply"
                  className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-md bg-lake px-3 py-2 text-sm text-sand">
                  Reply
                </button>
              </form>
            )}
          </div>
        ))}
        {reviews.length === 0 && !error && (
          <p className="text-ink-muted">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}
