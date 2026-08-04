"use client";

import { useEffect, useState } from "react";

type PayoutRow = {
  id: string;
  amount: number;
  commission: number;
  status: string;
  createdAt: string;
  booking?: {
    reference?: string;
    listing?: { title?: string } | null;
  } | null;
};

type PayoutData = {
  payouts: PayoutRow[];
  totalNet: number;
  totalCommission: number;
  pendingNet: number;
  processingNet: number;
  paidNet: number;
  nextSettlement: {
    cadenceDays: number;
    expectedDate: string | null;
    pendingCount: number;
    note: string;
  };
};

export default function ProviderPayoutsPage() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState("Platform");

  useEffect(() => {
    void fetch("/api/provider/payouts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      });
    void fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        if (d.platformName) setPlatformName(String(d.platformName));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Payouts
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Net amounts after {platformName} commission. Settlements are processed by
        the platform — you can track pending balance and the expected next pay
        window here.
      </p>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="mt-4 text-ink-muted">Loading…</p>}
      {data && (
        <>
          <div className="mt-6 rounded-xl border border-sun/40 bg-sun/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Next settlement
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-lake">
              {data.nextSettlement.expectedDate
                ? new Date(
                    `${data.nextSettlement.expectedDate}T12:00:00`,
                  ).toLocaleDateString("en-KE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "When balance clears"}
            </p>
            <p className="mt-2 text-sm text-ink">
              Pending net{" "}
              <span className="font-semibold">
                KES {Number(data.pendingNet || 0).toLocaleString()}
              </span>
              {data.nextSettlement.pendingCount
                ? ` across ${data.nextSettlement.pendingCount} booking${
                    data.nextSettlement.pendingCount === 1 ? "" : "s"
                  }`
                : ""}
              . Cadence: every {data.nextSettlement.cadenceDays} day
              {data.nextSettlement.cadenceDays === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {data.nextSettlement.note}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-line bg-white/70 p-4">
              <p className="text-xs uppercase text-ink-muted">Pending</p>
              <p className="font-display text-2xl">
                KES {Number(data.pendingNet || 0).toLocaleString()}
              </p>
            </div>
            <div className="border border-line bg-white/70 p-4">
              <p className="text-xs uppercase text-ink-muted">Processing</p>
              <p className="font-display text-2xl">
                KES {Number(data.processingNet || 0).toLocaleString()}
              </p>
            </div>
            <div className="border border-line bg-white/70 p-4">
              <p className="text-xs uppercase text-ink-muted">Paid (all time)</p>
              <p className="font-display text-2xl">
                KES {Number(data.paidNet || 0).toLocaleString()}
              </p>
            </div>
            <div className="border border-line bg-white/70 p-4">
              <p className="text-xs uppercase text-ink-muted">Commission</p>
              <p className="font-display text-2xl">
                KES {Number(data.totalCommission || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <ul className="mt-8 space-y-3">
            {data.payouts?.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-line bg-white/70 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {p.booking?.listing?.title || "Booking"} ·{" "}
                    {p.booking?.reference}
                  </p>
                  <p className="text-ink-muted">
                    {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                    {p.commission
                      ? ` · commission KES ${Number(p.commission).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <p className="font-semibold text-lake">
                  KES {p.amount.toLocaleString()}
                </p>
              </li>
            ))}
            {!data.payouts?.length && (
              <li className="text-sm text-ink-muted">No payouts yet.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
