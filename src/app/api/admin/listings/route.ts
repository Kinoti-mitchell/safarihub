import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

const STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "SUSPENDED"];
const CATEGORIES = ["STAY", "EAT", "MOVE", "EXPLORE", "MEET"];

export async function GET(request: Request) {
  try {
    await requireAdminPermission("listing.publish");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const categoryParam = searchParams.get("category");
    const status =
      statusParam && STATUSES.includes(statusParam) ? statusParam : undefined;
    const category =
      categoryParam && CATEGORIES.includes(categoryParam)
        ? categoryParam
        : undefined;

    let query = db
      .from("Listing")
      .select(
        "id, title, category, status, featured, isPromoted, createdAt, provider:Provider(name), county:County(name), media:Media(id), roomTypes:RoomType(basePrice), reviews:Review(count), bookings:Booking(count)",
      )
      .order("createdAt", { ascending: false })
      .limit(200);
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);
    if (q) {
      // Title match only — PostgREST cannot filter on embedded relations here.
      query = query.ilike("title", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      category: string;
      status: string;
      featured: boolean;
      isPromoted: boolean;
      createdAt: string;
      provider: { name: string } | null;
      county: { name: string } | null;
      media: Array<{ id: string }>;
      roomTypes: Array<{ basePrice: number }>;
      reviews: Array<{ count: number }>;
      bookings: Array<{ count: number }>;
    }>;

    const listings = rows.map((l) => {
      const prices = l.roomTypes.map((r) => r.basePrice).filter((p) => p > 0);
      return {
        id: l.id,
        title: l.title,
        category: l.category,
        status: l.status,
        featured: l.featured,
        isPromoted: l.isPromoted,
        providerName: l.provider?.name ?? "—",
        countyName: l.county?.name ?? "—",
        photoCount: l.media.length,
        fromPrice: prices.length ? Math.min(...prices) : null,
        reviewCount: l.reviews?.[0]?.count ?? 0,
        bookingCount: l.bookings?.[0]?.count ?? 0,
        createdAt: l.createdAt,
      };
    });

    return jsonOk({ listings, total: listings.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
