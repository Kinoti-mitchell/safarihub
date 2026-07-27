"use client";

import { useId } from "react";
import type { ProviderChartData } from "@/lib/provider-charts";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#e0a41a",
  RESERVED: "#f2c75a",
  CONFIRMED: "#178076",
  COMPLETED: "#0a3834",
  CANCELLED: "#8a9a96",
  NO_SHOW: "#6b7c78",
  DECLINED: "#b56b6b",
};

function formatKes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function RevenueArea({
  days,
}: {
  days: ProviderChartData["days"];
}) {
  const gradId = useId().replace(/:/g, "");
  const W = 560;
  const H = 180;
  const padX = 8;
  const padY = 16;
  const maxRev = Math.max(...days.map((d) => d.revenue), 1);

  const points = days.map((d, i) => {
    const x =
      padX +
      (days.length <= 1 ? W / 2 : (i / (days.length - 1)) * (W - padX * 2));
    const yRev = H - padY - (d.revenue / maxRev) * (H - padY * 2);
    return { ...d, x, yRev };
  });

  const linePath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yRev.toFixed(1)}`,
    )
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath =
    points.length > 0
      ? `${linePath} L ${last.x.toFixed(1)} ${(H - padY).toFixed(1)} L ${first.x.toFixed(1)} ${(H - padY).toFixed(1)} Z`
      : "";

  const labelEvery = days.length > 10 ? 3 : days.length > 7 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      className="h-auto w-full"
      role="img"
      aria-label="Revenue over the last two weeks"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#178076" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#178076" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={W - padX}
          y1={padY + t * (H - padY * 2)}
          y2={padY + t * (H - padY * 2)}
          stroke="currentColor"
          strokeOpacity="0.08"
        />
      ))}
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
        className="provider-chart-draw"
      />
      <path
        d={linePath}
        fill="none"
        stroke="#0a3834"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="provider-chart-draw"
      />
      {points.map((p) =>
        p.bookings > 0 || p.revenue > 0 ? (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.yRev}
            r="3.5"
            fill="#e0a41a"
            stroke="#fbf9f5"
            strokeWidth="1.5"
          >
            <title>
              {p.label}: KES {p.revenue.toLocaleString()} · {p.bookings} booking
              {p.bookings === 1 ? "" : "s"}
            </title>
          </circle>
        ) : null,
      )}
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text
            key={`l-${p.key}`}
            x={p.x}
            y={H + 16}
            textAnchor="middle"
            className="fill-ink-muted text-[10px]"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function StatusBars({
  statuses,
}: {
  statuses: ProviderChartData["statuses"];
}) {
  const total = statuses.reduce((s, x) => s + x.count, 0) || 1;
  if (!statuses.length) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        No bookings yet — status mix will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-line/40">
        {statuses.map((s) => (
          <div
            key={s.key}
            className="h-full transition-all duration-700"
            style={{
              width: `${(s.count / total) * 100}%`,
              background: STATUS_COLORS[s.key] || "#178076",
            }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {statuses.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: STATUS_COLORS[s.key] || "#178076" }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">
              {s.label}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {s.count}
              <span className="ml-1 font-normal text-ink-muted">
                ({Math.round((s.count / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListingBars({
  listings,
}: {
  listings: ProviderChartData["topListings"];
}) {
  if (!listings.length) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        Publish listings and take bookings to see what sells.
      </p>
    );
  }
  const max = Math.max(...listings.map((l) => l.bookings), 1);

  return (
    <ul className="space-y-3">
      {listings.map((l, i) => (
        <li key={l.title}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">
              <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
              {l.title}
            </span>
            <span className="shrink-0 tabular-nums text-ink-muted">
              {l.bookings} · KES {formatKes(l.revenue)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lake to-lake-bright transition-all duration-700"
              style={{ width: `${Math.max(8, (l.bookings / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProviderDashboardCharts({
  data,
}: {
  data: ProviderChartData;
}) {
  const hasAny =
    data.periodBookings > 0 ||
    data.statuses.some((s) => s.count > 0) ||
    data.topListings.length > 0;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
            Performance
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Last 14 days ·{" "}
            <span className="font-medium text-ink">
              {data.periodBookings} booking
              {data.periodBookings === 1 ? "" : "s"}
            </span>
            {" · "}
            <span className="font-medium text-ink">
              KES {data.periodRevenue.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {!hasAny ? (
        <div className="provider-card mt-4 rounded-2xl p-6 text-center">
          <p className="text-sm text-ink-muted">
            Charts light up once guests start booking. Confirm your first
            reservation to see revenue and demand here.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="provider-card rounded-2xl p-5 lg:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">Revenue trend</h3>
              <span className="text-xs text-ink-muted">
                KES · paid / completed
              </span>
            </div>
            <div className="mt-3 text-ink">
              <RevenueArea days={data.days} />
            </div>
          </div>

          <div className="provider-card rounded-2xl p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-ink">Booking mix</h3>
            <p className="mt-0.5 text-xs text-ink-muted">All-time status split</p>
            <div className="mt-4">
              <StatusBars statuses={data.statuses} />
            </div>
          </div>

          <div className="provider-card rounded-2xl p-5 lg:col-span-5">
            <h3 className="text-sm font-semibold text-ink">Top listings</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              By booking volume · revenue shown beside each
            </p>
            <div className="mt-4">
              <ListingBars listings={data.topListings} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
