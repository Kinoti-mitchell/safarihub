"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  receiptNumber: string | null;
  amount: number;
  vatAmount: number;
  status: string;
  kraRef: string | null;
  errorMessage: string | null;
  retryCount: number | null;
  nextRetryAt: string | null;
  createdAt: string;
  provider: { name: string } | null;
  booking: { reference: string } | null;
};

export default function AdminEtimsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tallies, setTallies] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/etims");
      const body = await res.json();
      if (res.ok) {
        setRows(body.submissions || []);
        setTallies(body.tallies || {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function drain() {
    setBusy("drain");
    try {
      const res = await fetch("/api/admin/etims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "drain" }),
      });
      const body = await res.json();
      setMsg(
        res.ok
          ? `Processed ${body.processed}: ${body.submitted} submitted, ${body.failed} failed`
          : body.error || "Drain failed",
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function retry(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/etims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      const body = await res.json();
      setMsg(res.ok ? body.message || "Retried" : body.error || "Retry failed");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">
        eTIMS desk
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Fiscal queue with retries, idempotency, and live invoice envelope.
        Auto-queues on paid bookings when enabled.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-md bg-sun/20 px-3 py-1">
          Queued {tallies.QUEUED || 0}
        </span>
        <span className="rounded-md bg-lake/10 px-3 py-1 text-lake">
          Submitted {tallies.SUBMITTED || 0}
        </span>
        <span className="rounded-md bg-red-50 px-3 py-1 text-red-700">
          Failed {tallies.FAILED || 0}
        </span>
        <button
          type="button"
          disabled={busy === "drain"}
          onClick={() => void drain()}
          className="rounded-md bg-lake px-3 py-1 font-semibold text-sand"
        >
          Drain queue now
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-line px-3 py-1"
        >
          Refresh
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-ink-muted">{msg}</p>}

      {loading ? (
        <p className="mt-8 text-sm text-ink-muted">Loading…</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {r.booking?.reference || r.receiptNumber || r.id.slice(0, 8)} ·{" "}
                  {r.status}
                </p>
                <p className="text-xs text-ink-muted">
                  {r.provider?.name || "—"} · KES{" "}
                  {Number(r.amount || 0).toLocaleString()} (VAT{" "}
                  {Number(r.vatAmount || 0).toLocaleString()})
                  {r.kraRef ? ` · ${r.kraRef}` : ""}
                  {r.retryCount ? ` · retries ${r.retryCount}` : ""}
                  {r.errorMessage ? ` · ${r.errorMessage}` : ""}
                </p>
              </div>
              {(r.status === "FAILED" || r.status === "QUEUED") && (
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void retry(r.id)}
                  className="rounded-md border border-line px-2 py-1 text-xs"
                >
                  Retry
                </button>
              )}
            </li>
          ))}
          {!rows.length && (
            <li className="text-sm text-ink-muted">No eTIMS submissions yet</li>
          )}
        </ul>
      )}
    </div>
  );
}
