"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  accessToken?: string | null;
  canCancel: boolean;
  status: string;
};

export function ManageBookingActions({
  bookingId,
  accessToken,
  canCancel,
  status,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(status === "CANCELLED");

  async function cancel() {
    if (!canCancel || done) return;
    if (
      !window.confirm(
        "Cancel this booking? Rooms are released and paid amounts are marked for refund per policy.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qs = accessToken
        ? `?t=${encodeURIComponent(accessToken)}`
        : "";
      const res = await fetch(`/api/bookings/${bookingId}${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not cancel");
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

  if (done || status === "CANCELLED") {
    return (
      <p className="rounded-lg border border-line bg-sand/40 px-3 py-2 text-sm text-ink-muted">
        This booking is cancelled.
      </p>
    );
  }

  if (!canCancel) {
    return (
      <p className="text-sm text-ink-muted">
        Cancellation is closed for this stay. Contact support or your host for
        help.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Reason (optional)
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Change of plans…"
          className="mt-1 w-full rounded-md border border-line px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void cancel()}
        className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
      >
        {busy ? "Cancelling…" : "Cancel booking"}
      </button>
    </div>
  );
}
