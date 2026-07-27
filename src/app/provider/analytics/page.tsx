"use client";

import { useEffect, useState } from "react";
import { ProviderDashboardCharts } from "@/components/provider-dashboard-charts";
import type { ProviderChartData } from "@/lib/provider-charts";

type AnalyticsPayload = {
  listings: number;
  bookings: number;
  revenue: number;
  avgRating: number;
  reviewCount: number;
  payoutPending: number;
  commissionPaid: number;
  charts?: ProviderChartData;
  error?: string;
};

export default function ProviderAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/provider/analytics")
      .then((r) => r.json())
      .then((d: AnalyticsPayload) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Could not load insights"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Insights
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Revenue trend, booking mix and what guests book most.
      </p>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="mt-4 text-ink-muted">Loading…</p>}
      {data && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Listings", data.listings],
              ["Bookings", data.bookings],
              ["Revenue (KES)", Number(data.revenue || 0).toLocaleString()],
              ["Avg rating", data.avgRating || "—"],
              ["Reviews", data.reviewCount],
              [
                "Payout net (KES)",
                Number(data.payoutPending || 0).toLocaleString(),
              ],
              [
                "Commission (KES)",
                Number(data.commissionPaid || 0).toLocaleString(),
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="provider-card rounded-2xl border border-line/60 p-5"
              >
                <p className="text-xs uppercase tracking-wider text-ink-muted">
                  {label}
                </p>
                <p className="font-display mt-1 text-2xl font-semibold text-ink">
                  {value}
                </p>
              </div>
            ))}
          </div>
          {data.charts && <ProviderDashboardCharts data={data.charts} />}
        </>
      )}
    </div>
  );
}
