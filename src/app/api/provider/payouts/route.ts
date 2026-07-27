import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireProviderAccess } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);

    const { data: payouts, error } = await db
      .from("Payout")
      .select(
        "*, booking:Booking(reference, totalAmount, checkIn, listing:Listing(title))",
      )
      .eq("providerId", access.provider.id)
      .order("createdAt", { ascending: false })
      .limit(100);
    if (error) throw error;

    const { data: totalsRows } = await db
      .from("Payout")
      .select("amount, commission")
      .eq("providerId", access.provider.id);
    const totals = (totalsRows ?? []) as Array<{
      amount: number;
      commission: number;
    }>;

    return jsonOk({
      payouts,
      totalNet: totals.reduce((s, p) => s + (p.amount || 0), 0),
      totalCommission: totals.reduce((s, p) => s + (p.commission || 0), 0),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
