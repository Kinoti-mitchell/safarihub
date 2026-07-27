import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("review.moderate");
    const { id } = await params;

    const { data: review } = await db
      .from("Review")
      .select("id, rating, listing:Listing(title)")
      .eq("id", id)
      .maybeSingle();
    if (!review) return jsonError("Review not found", 404);
    const reviewRow = review as unknown as {
      rating: number;
      listing: { title: string } | null;
    };

    const { error: deleteError } = await db.from("Review").delete().eq("id", id);
    if (deleteError) throw deleteError;

    await logAudit({
      actor: admin,
      action: "review.delete",
      entityType: "Review",
      entityId: id,
      summary: `Removed a ${reviewRow.rating}★ review on "${reviewRow.listing?.title ?? "listing"}"`,
      metadata: { rating: reviewRow.rating },
    });

    return jsonOk({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
