"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { boostPeriodLabel } from "@/lib/boost-shared";

type BoostPlan = {
  id: string;
  period: string;
  label: string;
  priceKes: number;
  active: boolean;
  sortOrder: number;
};

type BoostRequest = {
  id: string;
  period: string;
  priceKes: number;
  status: string;
  paymentRef: string | null;
  paymentNote: string | null;
  adminNote: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  listing: { id: string; title: string; status: string } | null;
  provider: { id: string; name: string } | null;
};

type Toast = { id: number; message: string; tone: "success" | "error" };

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: "bg-sun/25 text-ink",
  ACTIVE: "bg-lake text-sand",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-sand text-ink-muted",
  CANCELLED: "bg-sand text-ink-muted",
};

function money(n: number) {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export default function AdminBoostPage() {
  const [plans, setPlans] = useState<BoostPlan[]>([]);
  const [requests, setRequests] = useState<BoostRequest[]>([]);
  const [filter, setFilter] = useState("PENDING_APPROVAL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/admin/boost/plans");
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load plans");
    const list: BoostPlan[] = body.plans || [];
    setPlans(list);
    setDraftPrices(
      Object.fromEntries(list.map((p) => [p.period, String(p.priceKes)])),
    );
  }, []);

  const loadRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/admin/boost/requests?${params}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load requests");
    setRequests(body.requests || []);
  }, [filter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPlans(), loadRequests()]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadPlans, loadRequests]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlan(period: string, e: FormEvent) {
    e.preventDefault();
    const priceKes = Math.round(Number(draftPrices[period] || 0));
    if (!Number.isFinite(priceKes) || priceKes < 0) {
      pushToast("Enter a valid price", "error");
      return;
    }
    setBusy(`plan-${period}`);
    try {
      const plan = plans.find((p) => p.period === period);
      const res = await fetch("/api/admin/boost/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          priceKes,
          active: plan?.active ?? true,
          label: plan?.label,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not save rate", "error");
        return;
      }
      pushToast(`${boostPeriodLabel(period)} rate saved`, "success");
      await loadPlans();
    } catch {
      pushToast("Network error", "error");
    } finally {
      setBusy(null);
    }
  }

  async function togglePlan(period: string, active: boolean) {
    setBusy(`toggle-${period}`);
    try {
      const plan = plans.find((p) => p.period === period);
      const res = await fetch("/api/admin/boost/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          active,
          priceKes: plan?.priceKes,
          label: plan?.label,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not update plan", "error");
        return;
      }
      pushToast(
        active ? `${boostPeriodLabel(period)} enabled` : `${boostPeriodLabel(period)} disabled`,
        "success",
      );
      await loadPlans();
    } catch {
      pushToast("Network error", "error");
    } finally {
      setBusy(null);
    }
  }

  async function act(
    id: string,
    action: "approve" | "reject" | "cancel",
  ) {
    const note =
      action === "reject"
        ? window.prompt("Rejection note (optional)") || undefined
        : action === "cancel"
          ? window.prompt("Cancel note (optional)") || undefined
          : undefined;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/boost/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Action failed", "error");
        return;
      }
      pushToast(
        action === "approve"
          ? "Boost approved — listing promoted"
          : action === "reject"
            ? "Request rejected"
            : "Boost cancelled",
        "success",
      );
      await loadRequests();
    } catch {
      pushToast("Network error", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Revenue
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">Listing boosts</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Set daily, weekly, monthly, and yearly rates. Providers request a boost
          after a listing is published; you approve once payment is verified.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="mb-10">
        <h2 className="font-display text-xl text-ink">Rates by period</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Toggle which periods providers can buy. Prices are in Kenyan shillings.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <form
              key={plan.id}
              onSubmit={(e) => void savePlan(plan.period, e)}
              className="rounded-lg border border-line bg-sand/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{plan.label}</p>
                  <p className="text-xs text-ink-muted">
                    {boostPeriodLabel(plan.period)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === `toggle-${plan.period}`}
                  onClick={() => void togglePlan(plan.period, !plan.active)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    plan.active
                      ? "bg-lake/15 text-lake"
                      : "bg-sand text-ink-muted"
                  }`}
                >
                  {plan.active ? "On" : "Off"}
                </button>
              </div>
              <label className="mt-3 block text-xs font-medium text-ink-muted">
                Price (KES)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draftPrices[plan.period] ?? ""}
                  onChange={(e) =>
                    setDraftPrices((d) => ({
                      ...d,
                      [plan.period]: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                />
              </label>
              <button
                type="submit"
                disabled={busy === `plan-${plan.period}`}
                className="mt-3 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-sand disabled:opacity-60"
              >
                {busy === `plan-${plan.period}` ? "Saving…" : "Save rate"}
              </button>
            </form>
          ))}
          {!loading && plans.length === 0 && (
            <p className="text-sm text-ink-muted sm:col-span-2">
              No boost plans found. Run{" "}
              <code className="rounded bg-sand px-1">db/2026-boost.sql</code> in
              Supabase, then refresh.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">Boost requests</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Verify the M-Pesa reference, then approve to promote the listing.
            </p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="">All</option>
          </select>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-ink-muted">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="mt-6 text-sm text-ink-muted">No requests in this filter.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-white/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_STYLE[r.status] || "bg-sand text-ink"
                        }`}
                      >
                        {r.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-sm font-semibold text-ink">
                        {boostPeriodLabel(r.period)} · {money(r.priceKes)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink">
                      {r.listing ? (
                        <Link
                          href={`/admin/listings/${r.listing.id}`}
                          className="underline decoration-line underline-offset-2"
                        >
                          {r.listing.title}
                        </Link>
                      ) : (
                        "Listing"
                      )}
                      {r.provider ? ` · ${r.provider.name}` : null}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Ref: <span className="font-mono text-ink">{r.paymentRef}</span>
                      {r.paymentNote ? ` · ${r.paymentNote}` : ""}
                    </p>
                    {r.endsAt && (
                      <p className="mt-1 text-xs text-ink-muted">
                        Ends {new Date(r.endsAt).toLocaleString("en-KE")}
                      </p>
                    )}
                    {r.adminNote && (
                      <p className="mt-1 text-xs text-ink-muted">
                        Note: {r.adminNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.status === "PENDING_APPROVAL" && (
                      <>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => void act(r.id, "approve")}
                          className="rounded-md bg-lake px-3 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => void act(r.id, "reject")}
                          className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-muted disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "ACTIVE" && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void act(r.id, "cancel")}
                        className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-muted disabled:opacity-60"
                      >
                        End early
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md px-4 py-2 text-sm shadow ${
              t.tone === "success"
                ? "bg-ink text-sand"
                : "bg-red-700 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
