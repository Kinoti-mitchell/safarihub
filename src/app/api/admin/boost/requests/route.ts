import { db } from "@/lib/supabase";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { expireDueBoosts } from "@/lib/boost";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("boost.manage");
    await expireDueBoosts();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";

    let query = db
      .from("BoostRequest")
      .select(
        "*, listing:Listing(id, title, slug, status, isPromoted, boostEndsAt), provider:Provider(id, name), plan:BoostPlan(id, period, label, priceKes)",
      )
      .order("createdAt", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const requests = (data ?? []).map((row) => {
      const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
      const provider = Array.isArray(row.provider)
        ? row.provider[0]
        : row.provider;
      const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
      return { ...row, listing, provider, plan };
    });

    const pending =
      requests.filter((r) => r.status === "PENDING_APPROVAL").length ||
      (
        await db
          .from("BoostRequest")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING_APPROVAL")
      ).count ||
      0;

    return jsonOk({ requests, pendingCount: pending });
  } catch (error) {
    return handleRouteError(error);
  }
}
