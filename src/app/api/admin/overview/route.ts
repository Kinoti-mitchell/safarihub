import { db } from "@/lib/supabase";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

const TREND_DAYS = 14;

async function countRows(table: string): Promise<number> {
  const { count } = await db
    .from(table)
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function GET() {
  try {
    await requireAdminPermission("analytics.view.all");

    const [users, providers, listings, bookings, revenueRows] =
      await Promise.all([
        countRows("User"),
        countRows("Provider"),
        countRows("Listing"),
        countRows("Booking"),
        db
          .from("Booking")
          .select("totalAmount")
          .in("paymentStatus", ["PAID", "NOT_REQUIRED"]),
      ]);
    const revenue = ((revenueRows.data ?? []) as Array<{ totalAmount: number }>)
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    // 14-day bookings + revenue trend for the dashboard chart
    const trendStart = new Date();
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

    const [recentBookingsRes, recentListingsRes] = await Promise.all([
      db
        .from("Booking")
        .select("createdAt, totalAmount, paymentStatus")
        .gte("createdAt", trendStart.toISOString()),
      db
        .from("Listing")
        .select(
          "id, title, category, status, createdAt, provider:Provider(name), county:County(name)",
        )
        .order("createdAt", { ascending: false })
        .limit(8),
    ]);
    const recentBookings = (recentBookingsRes.data ?? []) as Array<{
      createdAt: string;
      totalAmount: number;
      paymentStatus: string;
    }>;
    const recentListings = (
      (recentListingsRes.data ?? []) as unknown as Array<{
        id: string;
        title: string;
        category: string;
        status: string;
        createdAt: string;
        provider: { name: string } | null;
        county: { name: string } | null;
      }>
    ).map((l) => ({
      id: l.id,
      title: l.title,
      category: l.category,
      status: l.status,
      createdAt: l.createdAt,
      providerName: l.provider?.name ?? "—",
      countyName: l.county?.name ?? "—",
    }));

    const buckets = new Map<string, { bookings: number; revenue: number }>();
    for (let i = 0; i < TREND_DAYS; i++) {
      const d = new Date(trendStart);
      d.setDate(trendStart.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), { bookings: 0, revenue: 0 });
    }
    for (const b of recentBookings) {
      const key = b.createdAt.slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.bookings += 1;
      if (b.paymentStatus === "PAID" || b.paymentStatus === "NOT_REQUIRED") {
        bucket.revenue += b.totalAmount;
      }
    }
    const bookingsTrend = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      bookings: v.bookings,
      revenue: v.revenue,
    }));

    const [pendingListingsRes, pendingProvidersRes] = await Promise.all([
      db
        .from("Listing")
        .select(
          "id, title, category, description, address, createdAt, featured, isPromoted, provider:Provider(id, name, email, isApproved), county:County(name), town:Town(name), media:Media(id, url, isCover, sortOrder), roomTypes:RoomType(id, name, basePrice, quantity)",
        )
        .eq("status", "PENDING_REVIEW")
        .order("createdAt", { ascending: true })
        .limit(50),
      db
        .from("Provider")
        .select("*, listings:Listing(count)")
        .eq("isApproved", false)
        .order("createdAt", { ascending: true })
        .limit(50),
    ]);

    const pendingListingsView = (
      (pendingListingsRes.data ?? []) as unknown as Array<{
        id: string;
        title: string;
        category: string;
        description: string | null;
        address: string | null;
        createdAt: string;
        featured: boolean;
        isPromoted: boolean;
        provider: {
          id: string;
          name: string;
          email: string | null;
          isApproved: boolean;
        } | null;
        county: { name: string } | null;
        town: { name: string } | null;
        media: Array<{
          id: string;
          url: string;
          isCover: boolean;
          sortOrder: number;
        }>;
        roomTypes: Array<{
          id: string;
          name: string;
          basePrice: number;
          quantity: number;
        }>;
      }>
    ).map((l) => {
      const prices = l.roomTypes.map((r) => r.basePrice).filter((p) => p > 0);
      const cover =
        l.media.find((m) => m.isCover) ||
        [...l.media].sort((a, b) => a.sortOrder - b.sortOrder)[0] ||
        null;
      return {
        id: l.id,
        title: l.title,
        category: l.category,
        description: l.description,
        address: l.address,
        createdAt: l.createdAt,
        featured: l.featured,
        isPromoted: l.isPromoted,
        provider: l.provider,
        providerId: l.provider?.id ?? null,
        county: l.county,
        town: l.town,
        photoCount: l.media.length,
        coverUrl: cover?.url ?? null,
        offerCount: l.roomTypes.length,
        fromPrice: prices.length ? Math.min(...prices) : null,
      };
    });

    const pendingProviders = (
      (pendingProvidersRes.data ?? []) as Array<
        Record<string, unknown> & { listings?: Array<{ count: number }> }
      >
    ).map((p) => {
      const { listings: listingCount, ...rest } = p;
      return { ...rest, _count: { listings: listingCount?.[0]?.count ?? 0 } };
    });

    return jsonOk({
      stats: {
        users,
        providers,
        listings,
        bookings,
        revenue: revenue || 0,
      },
      bookingsTrend,
      recentListings,
      pendingListings: pendingListingsView,
      pendingProviders,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
