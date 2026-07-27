import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireProviderAccess } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import {
  buildProviderChartData,
  type ChartBooking,
} from "@/lib/provider-charts";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    const providerId = access.provider.id;

    const [listingsRes, bookingsRes, reviewsRes, payoutsRes] = await Promise.all([
      db
        .from("Listing")
        .select("id", { count: "exact", head: true })
        .eq("providerId", providerId),
      db
        .from("Booking")
        .select(
          "totalAmount, status, paymentStatus, createdAt, listing:Listing!inner(providerId, title)",
        )
        .eq("listing.providerId", providerId),
      db
        .from("Review")
        .select("rating, listing:Listing!inner(providerId)")
        .eq("listing.providerId", providerId),
      db.from("Payout").select("amount, commission").eq("providerId", providerId),
    ]);

    const bookings = (bookingsRes.data ?? []) as unknown as Array<{
      totalAmount: number;
      status: string;
      paymentStatus: string;
      createdAt: string;
      listing: { providerId: string; title: string } | null;
    }>;
    const reviews = (reviewsRes.data ?? []) as Array<{ rating: number }>;
    const payouts = (payoutsRes.data ?? []) as Array<{
      amount: number;
      commission: number;
    }>;

    const revenue = bookings
      .filter((b) => b.paymentStatus === "PAID" || b.status === "COMPLETED")
      .reduce((s, b) => s + b.totalAmount, 0);
    const avgRating =
      reviews.length === 0
        ? 0
        : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

    const chartBookings: ChartBooking[] = bookings.map((b) => ({
      totalAmount: b.totalAmount || 0,
      paymentStatus: b.paymentStatus,
      status: b.status,
      createdAt: b.createdAt,
      listingTitle: b.listing?.title || "Listing",
    }));

    return jsonOk({
      listings: listingsRes.count ?? 0,
      bookings: bookings.length,
      revenue,
      avgRating: Number(avgRating.toFixed(2)),
      reviewCount: reviews.length,
      payoutPending: payouts.reduce((s, p) => s + (p.amount || 0), 0),
      commissionPaid: payouts.reduce((s, p) => s + (p.commission || 0), 0),
      charts: buildProviderChartData(chartBookings, 14),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
