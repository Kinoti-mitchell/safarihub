export type ChartBooking = {
  totalAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  listingTitle: string;
};

export type DayPoint = {
  key: string;
  label: string;
  bookings: number;
  revenue: number;
};

export type StatusSlice = {
  key: string;
  label: string;
  count: number;
};

export type ListingBar = {
  title: string;
  bookings: number;
  revenue: number;
};

export type ProviderChartData = {
  days: DayPoint[];
  statuses: StatusSlice[];
  topListings: ListingBar[];
  periodRevenue: number;
  periodBookings: number;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  RESERVED: "Reserved",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  DECLINED: "Declined",
};

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastNDayKeys(n: number): { key: string; label: string; date: Date }[] {
  const out: { key: string; label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), label: dayLabel(d), date: d });
  }
  return out;
}

function isPaid(b: ChartBooking): boolean {
  return b.paymentStatus === "PAID" || b.status === "COMPLETED";
}

export function buildProviderChartData(
  bookings: ChartBooking[],
  days = 14,
): ProviderChartData {
  const dayMeta = lastNDayKeys(days);
  const dayMap = new Map(
    dayMeta.map((d) => [
      d.key,
      { key: d.key, label: d.label, bookings: 0, revenue: 0 } satisfies DayPoint,
    ]),
  );

  const statusMap = new Map<string, number>();
  const listingMap = new Map<
    string,
    { title: string; bookings: number; revenue: number }
  >();

  for (const b of bookings) {
    const created = new Date(b.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const key = dayKey(created);
    const day = dayMap.get(key);
    if (day) {
      day.bookings += 1;
      if (isPaid(b)) day.revenue += b.totalAmount || 0;
    }

    const status = b.status || "PENDING";
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    const title = (b.listingTitle || "Listing").trim() || "Listing";
    const row = listingMap.get(title) || {
      title,
      bookings: 0,
      revenue: 0,
    };
    row.bookings += 1;
    if (isPaid(b)) row.revenue += b.totalAmount || 0;
    listingMap.set(title, row);
  }

  const dayPoints = dayMeta.map((d) => dayMap.get(d.key)!);
  const periodRevenue = dayPoints.reduce((s, d) => s + d.revenue, 0);
  const periodBookings = dayPoints.reduce((s, d) => s + d.bookings, 0);

  // Prefer statuses that appear; keep a stable order
  const order = [
    "PENDING",
    "RESERVED",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "DECLINED",
  ];
  const statuses: StatusSlice[] = [
    ...order
      .filter((k) => statusMap.has(k))
      .map((k) => ({
        key: k,
        label: STATUS_LABELS[k] || k,
        count: statusMap.get(k) || 0,
      })),
    ...[...statusMap.keys()]
      .filter((k) => !order.includes(k))
      .map((k) => ({
        key: k,
        label: STATUS_LABELS[k] || k,
        count: statusMap.get(k) || 0,
      })),
  ];

  const topListings = [...listingMap.values()]
    .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue)
    .slice(0, 5);

  return {
    days: dayPoints,
    statuses,
    topListings,
    periodRevenue,
    periodBookings,
  };
}
