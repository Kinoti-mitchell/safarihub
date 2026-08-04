"use client";

import { useCallback, useEffect, useState } from "react";

type Dispute = {
  id: string;
  bookingId: string;
  reason: string;
  status: string;
  guestClaim: string | null;
  providerClaim: string | null;
  refundAmount: number | null;
  createdAt: string;
  booking: {
    reference: string;
    status: string;
    paymentStatus: string;
    guestName: string | null;
    totalAmount: number;
  } | null;
  provider: { name: string } | null;
};

type Toast = { id: number; message: string; tone: "success" | "error" };

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("Guest complaint");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/disputes");
      const body = await res.json();
      if (res.ok) setDisputes(body.disputes || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDispute() {
    if (!bookingId.trim()) return;
    setBusy("open");
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: bookingId.trim(), reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not open dispute", "error");
        return;
      }
      pushToast("Dispute opened — payout held", "success");
      setBookingId("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function resolve(
    disputeId: string,
    resolution:
      | "RESOLVED_GUEST"
      | "RESOLVED_PROVIDER"
      | "RESOLVED_PARTIAL"
      | "CLOSED",
  ) {
    let refundAmount: number | undefined;
    if (resolution === "RESOLVED_PARTIAL") {
      const raw = window.prompt("Partial refund amount (KES):", "");
      if (raw == null) return;
      refundAmount = Number(raw);
      if (!refundAmount || refundAmount <= 0) {
        pushToast("Enter a positive refund amount", "error");
        return;
      }
    }
    const note = window.prompt("Resolution note (optional):", "") ?? undefined;
    setBusy(disputeId);
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          resolution,
          resolutionNote: note,
          refundAmount,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Resolve failed", "error");
        return;
      }
      pushToast(body.message || "Resolved", "success");
      await load();
    } finally {
      setBusy(null);
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

      <h1 className="font-display text-3xl font-semibold text-lake">
        Disputes & holds
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Open a dispute to hold payout. Resolve for guest (refund), provider
        (release payout), or partial.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white/70 p-4">
        <label className="block text-xs text-ink-muted">
          Booking ID
          <input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            className="mt-1 block w-64 rounded-md border border-line px-3 py-2 text-sm"
            placeholder="cuid…"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-64 rounded-md border border-line px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy === "open"}
          onClick={() => void openDispute()}
          className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand"
        >
          Open + hold payout
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-ink-muted">Loading…</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {disputes.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-line bg-white/70 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {d.booking?.reference || d.bookingId}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {d.provider?.name || "—"} · {d.status} ·{" "}
                    {d.booking?.guestName || "Guest"}
                  </p>
                  <p className="mt-1 text-sm">{d.reason}</p>
                  {d.guestClaim && (
                    <p className="mt-1 text-xs text-ink-muted">
                      Guest: {d.guestClaim}
                    </p>
                  )}
                  {d.providerClaim && (
                    <p className="text-xs text-ink-muted">
                      Provider: {d.providerClaim}
                    </p>
                  )}
                </div>
                {["OPEN", "HOLDING"].includes(d.status) && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => void resolve(d.id, "RESOLVED_GUEST")}
                      className="rounded-md bg-lake px-2 py-1 text-xs text-sand"
                    >
                      Refund guest
                    </button>
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => void resolve(d.id, "RESOLVED_PARTIAL")}
                      className="rounded-md border border-line px-2 py-1 text-xs"
                    >
                      Partial refund
                    </button>
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => void resolve(d.id, "RESOLVED_PROVIDER")}
                      className="rounded-md border border-line px-2 py-1 text-xs"
                    >
                      Release to provider
                    </button>
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => void resolve(d.id, "CLOSED")}
                      className="rounded-md border border-line px-2 py-1 text-xs"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {!disputes.length && (
            <li className="text-sm text-ink-muted">No disputes yet</li>
          )}
        </ul>
      )}
    </div>
  );
}
