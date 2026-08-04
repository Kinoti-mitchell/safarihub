import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireProviderAccess } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { getPlatformName } from "@/lib/branding";
import { getPlatformSettings, numberSetting } from "@/lib/settings";

function addDaysISO(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

    const rows = (payouts ?? []) as Array<{
      amount: number;
      commission: number;
      status: string;
      createdAt: string;
    }>;

    const totalNet = rows.reduce((s, p) => s + (p.amount || 0), 0);
    const totalCommission = rows.reduce((s, p) => s + (p.commission || 0), 0);
    const pending = rows.filter((p) => p.status === "PENDING");
    const processing = rows.filter((p) => p.status === "PROCESSING");
    const paid = rows.filter((p) => p.status === "PAID");
    const pendingNet = pending.reduce((s, p) => s + (p.amount || 0), 0);
    const processingNet = processing.reduce((s, p) => s + (p.amount || 0), 0);
    const paidNet = paid.reduce((s, p) => s + (p.amount || 0), 0);

    const settings = await getPlatformSettings();
    const cadenceDays = Math.max(
      1,
      Math.round(numberSetting(settings, "payout.settlementCadenceDays") || 7),
    );

    let expectedDate: string | null = null;
    if (pending.length || processing.length) {
      const oldest = [...pending, ...processing].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0];
      const base = oldest ? new Date(oldest.createdAt) : new Date();
      expectedDate = addDaysISO(base, cadenceDays);
      const today = addDaysISO(new Date(), 0);
      if (expectedDate < today) {
        expectedDate = addDaysISO(new Date(), 1);
      }
    }

    const platformName = await getPlatformName();
    return jsonOk({
      payouts,
      totalNet,
      totalCommission,
      pendingNet,
      processingNet,
      paidNet,
      nextSettlement: {
        cadenceDays,
        expectedDate,
        pendingCount: pending.length,
        note:
          pendingNet > 0 || processingNet > 0
            ? `${platformName} settles pending balances on this cadence. Processing means an M-Pesa payout was started.`
            : "No pending balance — new confirmed payments will appear here for the next settlement window.",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
