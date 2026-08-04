"use client";

import { useCallback, useEffect, useState } from "react";

type AdminPayout = {
  id: string;
  providerName: string;
  reference: string;
  listingTitle: string;
  amount: number;
  commission: number;
  status: string;
  createdAt: string;
};

type Toast = { id: number; message: string; tone: "success" | "error" };

const STATUSES = [
  "PENDING",
  "PROCESSING",
  "ON_HOLD",
  "PAID",
  "FAILED",
] as const;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-sun/20 text-ink",
  PROCESSING: "bg-lake/10 text-lake",
  ON_HOLD: "bg-amber-100 text-amber-900",
  PAID: "bg-lake text-sand",
  FAILED: "bg-red-100 text-red-700",
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [netTotal, setNetTotal] = useState(0);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
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
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/payouts?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load payouts");
        return;
      }
      setError(null);
      setPayouts(body.payouts || []);
      setPendingTotal(body.pendingTotal || 0);
      setNetTotal(body.netTotal || 0);
      setCommissionTotal(body.commissionTotal || 0);
    } catch {
      setError("Network error — could not load payouts");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function setPayoutStatus(payout: AdminPayout, next: string) {
    setBusyId(payout.id);
    try {
      const res = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not update payout", "error");
        return;
      }
      pushToast(
        `Payout to ${payout.providerName} marked ${next.toLowerCase()}`,
        "success",
      );
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBatch(mode: "sendMpesa" | "markPaid") {
    if (!selected.size) {
      pushToast("Select at least one pending payout", "error");
      return;
    }
    setBatchBusy(true);
    try {
      const res = await fetch("/api/admin/payouts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutIds: Array.from(selected),
          sendMpesa: mode === "sendMpesa",
          markPaid: mode === "markPaid",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Batch failed", "error");
        return;
      }
      pushToast(body.summary || "Batch complete", "success");
      setSelected(new Set());
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setBatchBusy(false);
    }
  }

  async function sendMpesa(payout: AdminPayout) {
    setBusyId(payout.id);
    try {
      const res = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendMpesa: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "M-Pesa payout failed", "error");
        return;
      }
      pushToast(
        body.message ||
          `M-Pesa B2C sent to ${payout.providerName}`,
        "success",
      );
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

      <h1 className="font-display text-3xl font-semibold text-lake">Payouts</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Settlement runbook: select pending rows → batch Pay M-Pesa or Mark paid.
        Guards block KYC rejects, missing payout phone, disputes, and holds.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={batchBusy || !selected.size}
          onClick={() => void runBatch("sendMpesa")}
          className="rounded-md bg-lake px-3 py-2 text-sm font-semibold text-sand disabled:opacity-50"
        >
          Batch Pay M-Pesa ({selected.size})
        </button>
        <button
          type="button"
          disabled={batchBusy || !selected.size}
          onClick={() => void runBatch("markPaid")}
          className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
        >
          Batch mark paid
        </button>
        <button
          type="button"
          onClick={() =>
            setSelected(
              new Set(
                payouts
                  .filter((p) => p.status === "PENDING")
                  .map((p) => p.id),
              ),
            )
          }
          className="rounded-md border border-line px-3 py-2 text-sm"
        >
          Select all pending
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white/70 p-4">
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Awaiting payout
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-lake">
            KES {pendingTotal.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white/70 p-4">
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Net to providers
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            KES {netTotal.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white/70 p-4">
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Commission earned
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            KES {commissionTotal.toLocaleString()}
          </p>
        </div>
      </div>

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
          All
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
            {s.toLowerCase()}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by provider or booking reference…"
        className="mt-4 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm"
      />

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading payouts…</p>
      ) : payouts.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          No payouts match your filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white/70">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3 font-medium"> </th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      disabled={p.status === "PAID" || p.status === "ON_HOLD"}
                      onChange={() => toggleSelect(p.id)}
                      aria-label={`Select ${p.reference}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{p.providerName}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{p.reference}</p>
                    <p className="text-xs text-ink-muted">{p.listingTitle}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    KES {p.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    KES {p.commission.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        STATUS_STYLE[p.status] || "bg-sand text-ink"
                      }`}
                    >
                      {p.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(p.status === "PENDING" || p.status === "FAILED") && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void sendMpesa(p)}
                          className="rounded-md border border-lake px-3 py-1 text-xs font-semibold text-lake transition hover:bg-lake/10 disabled:opacity-50"
                        >
                          Pay M-Pesa
                        </button>
                      )}
                      {p.status !== "PAID" && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void setPayoutStatus(p, "PAID")}
                          className="rounded-md bg-lake px-3 py-1 text-xs font-semibold text-sand transition hover:bg-lake-bright disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )}
                      {p.status === "PENDING" && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void setPayoutStatus(p, "PROCESSING")}
                          className="rounded-md border border-line px-3 py-1 text-xs transition hover:border-lake-bright disabled:opacity-50"
                        >
                          Processing
                        </button>
                      )}
                      {p.status === "PROCESSING" && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void setPayoutStatus(p, "FAILED")}
                          className="rounded-md border border-line px-3 py-1 text-xs text-red-700 transition hover:border-red-300 disabled:opacity-50"
                        >
                          Failed
                        </button>
                      )}
                      {p.status === "FAILED" && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void setPayoutStatus(p, "PENDING")}
                          className="rounded-md border border-line px-3 py-1 text-xs transition hover:border-lake-bright disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
