import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("review.moderate");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const ratingParam = Number(searchParams.get("rating"));
    const rating =
      ratingParam >= 1 && ratingParam <= 5 ? Math.floor(ratingParam) : undefined;

    let query = db
      .from("Review")
      .select(
        "id, rating, comment, reply, createdAt, listing:Listing(title), traveler:User(name, email)",
      )
      .order("createdAt", { ascending: false })
      .limit(200);
    if (rating) query = query.eq("rating", rating);
    if (q) {
      query = query.ilike("comment", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      rating: number;
      comment: string | null;
      reply: string | null;
      createdAt: string;
      listing: { title: string } | null;
      traveler: { name: string | null; email: string } | null;
    }>;

    const reviews = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      reply: r.reply,
      listingTitle: r.listing?.title ?? "—",
      travelerName: r.traveler?.name ?? null,
      travelerEmail: r.traveler?.email ?? "—",
      createdAt: r.createdAt,
    }));

    const avgRating =
      rows.length === 0
        ? 0
        : Number(
            (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(2),
          );

    return jsonOk({ reviews, total: reviews.length, avgRating });
  } catch (error) {
    return handleRouteError(error);
  }
}
