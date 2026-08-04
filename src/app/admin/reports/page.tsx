"use client";

import { useCallback, useEffect, useState } from "react";

type Report = {
  totals: {
    users: number;
    providers: number;
    approvedProviders: number;
    publishedListings: number;
    bookings: number;
    revenue: number;
    avgRating: number;
    reviews: number;
    countiesLive: number;
    countiesTotal: number;
  };
  ops?: {
    conversionRate: number;
    mpesaSuccessRate: number;
    mpesaPaid: number;
    mpesaFailed: number;
    refundedBookings: number;
    refundVolume: number;
    noShows: number;
    openDisputes: number;
    payoutOnHold: number;
    etimsQueued: number;
    etimsFailed: number;
  };
  monthly: { label: string; bookings: number; revenue: number }[];
  bookingsByStatus: { status: string; count: number }[];
  paymentsByStatus: { status: string; count: number; amount: number }[];
  payoutsByStatus: { status: string; count: number; amount: number }[];
  reviewDistribution: { rating: number; count: number }[];
  usersByRole: { role: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  topListings: { id: string; title: string; provider: string; bookings: number }[];
  topCounties: { id: string; name: string; isLive: boolean; listings: number }[];
};

const money = (n: number) => `KES ${n.toLocaleString()}`;

export default function AdminReportsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reports");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load reports");
        return;
      }
      setError(null);
      setData(body);
    } catch {
      setError("Network error — could not reach the server");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="px-4 py-12 sm:px-8">
        <div className="border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-md bg-lake px-3 py-1.5 text-sm text-sand"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-12 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-white/60" />
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">Loading reports…</p>
      </div>
    );
  }

  const t = data.totals;
  const ops = data.ops;
  const maxMonthly = Math.max(1, ...data.monthly.map((m) => m.bookings));
  const maxRevenue = Math.max(1, ...data.monthly.map((m) => m.revenue));

  return (
    <div className="px-4 py-10 sm:px-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lake">Insights</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Aggregated hospitality demand for operators, counties and partners —
          bookings, revenue, listings, payments health and markets.
        </p>
      </div>

      {ops && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Pay conversion" value={`${ops.conversionRate}%`} />
          <Kpi label="M-Pesa success" value={`${ops.mpesaSuccessRate}%`} />
          <Kpi label="Refund volume" value={money(ops.refundVolume)} />
          <Kpi label="Payouts on hold" value={money(ops.payoutOnHold)} />
          <Kpi label="Open disputes" value={String(ops.openDisputes)} />
          <Kpi label="No-shows" value={String(ops.noShows)} />
          <Kpi label="eTIMS queued" value={String(ops.etimsQueued)} />
          <Kpi label="eTIMS failed" value={String(ops.etimsFailed)} />
        </div>
      )}

      {/* KPI row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total revenue" value={money(t.revenue)} />
        <Kpi label="Bookings" value={t.bookings.toLocaleString()} />
        <Kpi
          label="Published listings"
          value={t.publishedListings.toLocaleString()}
        />
        <Kpi
          label="Avg rating"
          value={`${t.avgRating.toFixed(1)} ★`}
          sub={`${t.reviews} review${t.reviews === 1 ? "" : "s"}`}
        />
        <Kpi label="Users" value={t.users.toLocaleString()} />
        <Kpi
          label="Providers"
          value={t.providers.toLocaleString()}
          sub={`${t.approvedProviders} approved`}
        />
        <Kpi
          label="Live markets"
          value={`${t.countiesLive}/${t.countiesTotal}`}
          sub="counties live"
        />
      </div>

      {/* Revenue & bookings trend */}
      <Section title="Revenue & bookings · last 6 months">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
              Bookings
            </p>
            <div className="flex h-40 items-end gap-2">
              {data.monthly.map((m) => (
                <div
                  key={m.label}
                  className="group flex flex-1 flex-col items-center justify-end gap-1"
                  title={`${m.label}: ${m.bookings} bookings`}
                >
                  <span className="text-[0.6rem] text-ink-muted">{m.bookings}</span>
                  <div
                    className="w-full rounded-t bg-lake/80 transition-all group-hover:bg-lake"
                    style={{ height: `${Math.max(2, (m.bookings / maxMonthly) * 100)}%` }}
                  />
                  <span className="text-[0.6rem] text-ink-muted">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
              Revenue
            </p>
            <div className="flex h-40 items-end gap-2">
              {data.monthly.map((m) => (
                <div
                  key={m.label}
                  className="group flex flex-1 flex-col items-center justify-end gap-1"
                  title={`${m.label}: ${money(m.revenue)}`}
                >
                  <div
                    className="w-full rounded-t bg-sun/80 transition-all group-hover:bg-sun"
                    style={{ height: `${Math.max(2, (m.revenue / maxRevenue) * 100)}%` }}
                  />
                  <span className="text-[0.6rem] text-ink-muted">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Bookings by status" inGrid>
          <BarList
            items={data.bookingsByStatus.map((b) => ({
              label: b.status.toLowerCase(),
              value: b.count,
            }))}
          />
        </Section>

        <Section title="Payments" inGrid>
          <BarList
            items={data.paymentsByStatus.map((p) => ({
              label: p.status.toLowerCase(),
              value: p.count,
              sub: money(p.amount),
            }))}
          />
        </Section>

        <Section title="Payouts to providers" inGrid>
          {data.payoutsByStatus.length === 0 ? (
            <Empty>No payouts recorded yet.</Empty>
          ) : (
            <BarList
              items={data.payoutsByStatus.map((p) => ({
                label: p.status.toLowerCase(),
                value: p.count,
                sub: money(p.amount),
              }))}
            />
          )}
        </Section>

        <Section title="Ratings distribution" inGrid>
          {t.reviews === 0 ? (
            <Empty>No reviews yet.</Empty>
          ) : (
            <BarList
              items={data.reviewDistribution.map((r) => ({
                label: `${r.rating} ★`,
                value: r.count,
              }))}
            />
          )}
        </Section>

        <Section title="Users by role" inGrid>
          <BarList
            items={data.usersByRole.map((u) => ({
              label: u.role.toLowerCase(),
              value: u.count,
            }))}
          />
        </Section>

        <Section title="Listings by category" inGrid>
          <BarList
            items={data.categoryBreakdown.map((c) => ({
              label: c.category.toLowerCase(),
              value: c.count,
            }))}
          />
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Top listings by bookings" inGrid>
          {data.topListings.length === 0 ? (
            <Empty>No bookings yet.</Empty>
          ) : (
            <ul className="divide-y divide-line/60">
              {data.topListings.map((l, i) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lake/10 text-xs font-semibold text-lake">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.title}</span>
                    <span className="block truncate text-xs text-ink-muted">{l.provider}</span>
                  </span>
                  <span className="text-sm font-semibold">{l.bookings}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Market coverage · listings per county" inGrid>
          {data.topCounties.length === 0 ? (
            <Empty>No counties configured.</Empty>
          ) : (
            <BarList
              items={data.topCounties.map((c) => ({
                label: c.name,
                value: c.listings,
                sub: c.isLive ? "live" : "dark",
              }))}
            />
          )}
        </Section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/70 p-4">
      <p className="text-xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  children,
  inGrid,
}: {
  title: string;
  children: React.ReactNode;
  inGrid?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-white/70 p-5 ${inGrid ? "" : "mt-6"}`}
    >
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BarList({
  items,
}: {
  items: { label: string; value: number; sub?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <Empty>No data.</Empty>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="capitalize text-ink">{item.label}</span>
            <span className="font-medium">
              {item.value.toLocaleString()}
              {item.sub && (
                <span className="ml-2 text-xs font-normal text-ink-muted">
                  {item.sub}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full bg-lake"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}
