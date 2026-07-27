import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

const TREND_MONTHS = 6;

function tally<T extends string | number>(
  rows: Array<Record<string, unknown>>,
  key: string,
): Map<T, { count: number }> {
  const map = new Map<T, { count: number }>();
  for (const r of rows) {
    const k = r[key] as T;
    const cur = map.get(k) ?? { count: 0 };
    cur.count += 1;
    map.set(k, cur);
  }
  return map;
}

export async function GET() {
  try {
    await requireAdminPermission("analytics.view.all");

    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth() - (TREND_MONTHS - 1),
      1,
    );

    const [
      bookingsRes,
      usersRes,
      listingsRes,
      payoutsRes,
      reviewsRes,
      countiesRes,
      topListingsRes,
    ] = await Promise.all([
      db.from("Booking").select("status, paymentStatus, totalAmount, createdAt"),
      db.from("User").select("role"),
      db.from("Listing").select("status, category"),
      db.from("Payout").select("status, amount"),
      db.from("Review").select("rating"),
      db.from("County").select("id, name, isLive, listings:Listing(count)"),
      db
        .from("Listing")
        .select("id, title, provider:Provider(name), bookings:Booking(count)"),
    ]);

    const bookings = (bookingsRes.data ?? []) as Array<{
      status: string;
      paymentStatus: string;
      totalAmount: number;
      createdAt: string;
    }>;
    const users = (usersRes.data ?? []) as Array<{ role: string }>;
    const listings = (listingsRes.data ?? []) as Array<{
      status: string;
      category: string;
    }>;
    const payouts = (payoutsRes.data ?? []) as Array<{
      status: string;
      amount: number;
    }>;
    const reviews = (reviewsRes.data ?? []) as Array<{ rating: number }>;
    const counties = (countiesRes.data ?? []) as Array<{
      id: string;
      name: string;
      isLive: boolean;
      listings?: Array<{ count: number }>;
    }>;
      const topListingRows = (topListingsRes.data ?? []) as unknown as Array<{
        id: string;
        title: string;
        provider: { name: string } | null;
        bookings?: Array<{ count: number }>;
      }>;

    const isPaid = (s: string) => s === "PAID" || s === "NOT_REQUIRED";
    const revenue = bookings
      .filter((b) => isPaid(b.paymentStatus))
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    // Monthly bookings + revenue trend
    const buckets = new Map<string, { bookings: number; revenue: number }>();
    for (let i = 0; i < TREND_MONTHS; i++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { bookings: 0, revenue: 0 });
    }
    for (const b of bookings) {
      const d = new Date(b.createdAt);
      if (d < monthStart) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.bookings += 1;
      if (isPaid(b.paymentStatus)) bucket.revenue += b.totalAmount;
    }
    const monthly = Array.from(buckets.entries()).map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        label: new Date(y, m, 1).toLocaleDateString("en-US", { month: "short" }),
        bookings: v.bookings,
        revenue: v.revenue,
      };
    });

    const bookingStatusMap = tally<string>(bookings, "status");
    const paymentSumMap = new Map<string, { count: number; amount: number }>();
    for (const b of bookings) {
      const cur = paymentSumMap.get(b.paymentStatus) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += b.totalAmount || 0;
      paymentSumMap.set(b.paymentStatus, cur);
    }
    const payoutSumMap = new Map<string, { count: number; amount: number }>();
    for (const p of payouts) {
      const cur = payoutSumMap.get(p.status) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += p.amount || 0;
      payoutSumMap.set(p.status, cur);
    }
    const userRoleMap = tally<string>(users, "role");
    const categoryMap = tally<string>(listings, "category");

    const distMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) distMap[r.rating] = (distMap[r.rating] ?? 0) + 1;
    const avgRating =
      reviews.length === 0
        ? 0
        : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

    const topListings = topListingRows
      .map((l) => ({
        id: l.id,
        title: l.title,
        provider: l.provider?.name || "—",
        bookings: l.bookings?.[0]?.count ?? 0,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    const topCounties = counties
      .map((c) => ({
        id: c.id,
        name: c.name,
        isLive: c.isLive,
        listings: c.listings?.[0]?.count ?? 0,
      }))
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 6);

    return jsonOk({
      totals: {
        users: users.length,
        providers: (await countRows("Provider")),
        approvedProviders: await countRows("Provider", ["isApproved", true]),
        publishedListings: listings.filter((l) => l.status === "PUBLISHED").length,
        bookings: bookings.length,
        revenue,
        avgRating,
        reviews: reviews.length,
        countiesLive: counties.filter((c) => c.isLive).length,
        countiesTotal: counties.length,
      },
      monthly,
      bookingsByStatus: Array.from(bookingStatusMap.entries()).map(
        ([status, v]) => ({ status, count: v.count }),
      ),
      paymentsByStatus: Array.from(paymentSumMap.entries()).map(
        ([status, v]) => ({ status, count: v.count, amount: v.amount }),
      ),
      payoutsByStatus: Array.from(payoutSumMap.entries()).map(([status, v]) => ({
        status,
        count: v.count,
        amount: v.amount,
      })),
      reviewDistribution: [5, 4, 3, 2, 1].map((r) => ({
        rating: r,
        count: distMap[r],
      })),
      usersByRole: Array.from(userRoleMap.entries()).map(([role, v]) => ({
        role,
        count: v.count,
      })),
      categoryBreakdown: Array.from(categoryMap.entries()).map(
        ([category, v]) => ({ category, count: v.count }),
      ),
      topListings,
      topCounties,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function countRows(
  table: string,
  eq?: [string, string | number | boolean],
): Promise<number> {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (eq) q = q.eq(eq[0], eq[1]);
  const { count } = await q;
  return count ?? 0;
}
