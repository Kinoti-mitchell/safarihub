"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookingId: string;
  accessToken?: string | null;
};

/** Review form for completed stays on the manage/confirmation page. */
export function GuestBookingReview({ bookingId, accessToken }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: Number(form.get("rating")),
          comment: String(form.get("comment") || "") || undefined,
          accessToken: accessToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not post review");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg border border-lake/20 bg-lake/5 px-3 py-2 text-sm text-lake">
        Thanks — your review was posted.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <p className="text-sm text-ink-muted">
        How was your stay? Your feedback helps other travellers.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          name="rating"
          className="rounded-md border border-line px-2 py-1.5 text-sm"
          defaultValue={5}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} stars
            </option>
          ))}
        </select>
        <input
          name="comment"
          placeholder="Share how it went…"
          className="min-w-[200px] flex-1 rounded-md border border-line px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-lake px-3 py-1.5 text-sm font-semibold text-sand transition hover:bg-lake-bright disabled:opacity-60"
        >
          {busy ? "Posting…" : "Post review"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
