"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Toast = { id: number; message: string; tone: "success" | "error" };

export default function AdminPaymentsDeskPage() {
  const [tab, setTab] = useState<"exceptions" | "refunds" | "events">(
    "exceptions",
  );
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?tab=${tab}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load");
        return;
      }
      setError(null);
      setData(body);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, payload: Record<string, string>) {
    const key = `${action}:${payload.bookingId || payload.refundId || ""}`;
    setBusy(key);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Action failed", "error");
        return;
      }
      pushToast(body.message || "Done", "success");
      await load();
    } catch {
      pushToast("Network error", "error");
    } finally {
      setBusy(null);
    }
  }

  const stuck = (data?.stuckMpesa as Array<Record<string, unknown>>) || [];
  const failed = (data?.failedPayments as Array<Record<string, unknown>>) || [];
  const refunds = (data?.openRefunds as Array<Record<string, unknown>>) ||
    (data?.refunds as Array<Record<string, unknown>>) ||
    [];
  const payouts =
    (data?.payoutExceptions as Array<Record<string, unknown>>) || [];
  const events = (data?.events as Array<Record<string, unknown>>) || [];

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
        Payments desk
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Stuck STK, failed payments, refunds, and B2C exceptions — re-query,
        confirm, or refund from here.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["exceptions", "Exceptions"],
            ["refunds", "Refunds"],
            ["events", "Event log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? "bg-lake text-sand"
                : "border border-line bg-white text-ink-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && <p className="mt-6 text-sm text-ink-muted">Loading…</p>}

      {!loading && tab === "exceptions" && (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Stuck M-Pesa ({stuck.length})
            </h2>
            <p className="text-xs text-ink-muted">
              PENDING longer than {String(data?.stuckMinutes ?? 15)} minutes
            </p>
            <ul className="mt-3 space-y-2">
              {stuck.map((p) => {
                const booking = p.booking as Record<string, unknown> | null;
                const bid = p.bookingId as string;
                return (
                  <li
                    key={p.id as string}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {(booking?.reference as string) || bid}
                      </p>
                      <p className="text-xs text-ink-muted">
                        KES {Number(p.amount || 0).toLocaleString()} ·{" "}
                        {(booking?.guestName as string) || "Guest"} ·{" "}
                        {p.providerRef ? String(p.providerRef).slice(0, 18) : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy === `requery:${bid}`}
                        onClick={() => void act("requery", { bookingId: bid })}
                        className="rounded-md border border-line px-2 py-1 text-xs"
                      >
                        Re-query STK
                      </button>
                      <button
                        type="button"
                        disabled={busy === `confirm_paid:${bid}`}
                        onClick={() =>
                          void act("confirm_paid", { bookingId: bid })
                        }
                        className="rounded-md bg-lake px-2 py-1 text-xs text-sand"
                      >
                        Confirm paid
                      </button>
                      <Link
                        href={`/admin/bookings`}
                        className="rounded-md border border-line px-2 py-1 text-xs"
                      >
                        Bookings
                      </Link>
                    </div>
                  </li>
                );
              })}
              {!stuck.length && (
                <li className="text-sm text-ink-muted">No stuck STK payments</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Failed payments ({failed.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {failed.map((p) => (
                <li
                  key={p.id as string}
                  className="rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
                >
                  <p className="font-medium">
                    {((p.booking as { reference?: string } | null)?.reference) ||
                      (p.bookingId as string)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {(p.note as string) || "Failed"} · KES{" "}
                    {Number(p.amount || 0).toLocaleString()}
                  </p>
                </li>
              ))}
              {!failed.length && (
                <li className="text-sm text-ink-muted">No recent failures</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Payout exceptions ({payouts.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {payouts.map((p) => (
                <li
                  key={p.id as string}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {(p.provider as { name?: string } | null)?.name || "—"} ·{" "}
                      {p.status as string}
                    </p>
                    <p className="text-xs text-ink-muted">
                      KES {Number(p.amount || 0).toLocaleString()}
                      {p.holdReason ? ` · ${p.holdReason}` : ""}
                      {p.b2cResultDesc ? ` · ${p.b2cResultDesc}` : ""}
                    </p>
                  </div>
                  <Link
                    href="/admin/payouts"
                    className="rounded-md border border-line px-2 py-1 text-xs"
                  >
                    Open payouts
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Open refunds ({refunds.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {refunds.map((r) => (
                <li
                  key={r.id as string}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {((r.booking as { reference?: string } | null)?.reference) ||
                        (r.bookingId as string)}{" "}
                      · {r.status as string}
                    </p>
                    <p className="text-xs text-ink-muted">
                      KES {Number(r.amount || 0).toLocaleString()} ·{" "}
                      {r.method as string}
                      {r.errorMessage ? ` · ${r.errorMessage}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {r.bookingId ? (
                      <button
                        type="button"
                        disabled={busy === `refund:${r.bookingId}`}
                        onClick={() =>
                          void act("refund", {
                            bookingId: r.bookingId as string,
                          })
                        }
                        className="rounded-md border border-line px-2 py-1 text-xs"
                      >
                        Retry reversal
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === `mark_refund_done:${r.id}`}
                      onClick={() =>
                        void act("mark_refund_done", {
                          refundId: r.id as string,
                        })
                      }
                      className="rounded-md bg-lake px-2 py-1 text-xs text-sand"
                    >
                      Mark completed
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {!loading && tab === "refunds" && (
        <ul className="mt-8 space-y-2">
          {refunds.map((r) => (
            <li
              key={r.id as string}
              className="rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {((r.booking as { reference?: string } | null)?.reference) ||
                  (r.bookingId as string)}{" "}
                · {r.status as string}
              </p>
              <p className="text-xs text-ink-muted">
                KES {Number(r.amount || 0).toLocaleString()} · {r.method as string}
              </p>
            </li>
          ))}
          {!refunds.length && (
            <li className="text-sm text-ink-muted">No refunds yet</li>
          )}
        </ul>
      )}

      {!loading && tab === "events" && (
        <ul className="mt-8 max-h-[70vh] space-y-1 overflow-auto text-xs">
          {events.map((e) => (
            <li
              key={e.id as string}
              className="rounded border border-line/60 bg-white/50 px-3 py-2 font-mono"
            >
              <span className="text-ink-muted">
                {String(e.createdAt || "").slice(0, 19)}
              </span>{" "}
              <span className="font-semibold">{e.kind as string}</span>{" "}
              {e.status ? `· ${e.status}` : ""}{" "}
              {e.bookingId ? `· ${String(e.bookingId).slice(0, 8)}` : ""}{" "}
              {e.note ? `— ${e.note}` : ""}
            </li>
          ))}
          {!events.length && (
            <li className="text-sm text-ink-muted">No payment events yet</li>
          )}
        </ul>
      )}
    </div>
  );
}
