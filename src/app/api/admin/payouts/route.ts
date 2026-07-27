import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

const STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED"];

export async function GET(request: Request) {
  try {
    await requireAdminPermission("payout.manage");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const status =
      statusParam && STATUSES.includes(statusParam) ? statusParam : undefined;

    let query = db
      .from("Payout")
      .select(
        "id, amount, commission, status, createdAt, provider:Provider(name), booking:Booking(reference, listing:Listing(title))",
      )
      .order("createdAt", { ascending: false })
      .limit(200);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      amount: number;
      commission: number;
      status: string;
      createdAt: string;
      provider: { name: string } | null;
      booking: { reference: string; listing: { title: string } | null } | null;
    }>;

    const filtered = q
      ? rows.filter((p) => {
          const needle = q.toLowerCase();
          return (
            (p.provider?.name ?? "").toLowerCase().includes(needle) ||
            (p.booking?.reference ?? "").toLowerCase().includes(needle)
          );
        })
      : rows;

    const payouts = filtered.map((p) => ({
      id: p.id,
      providerName: p.provider?.name ?? "—",
      reference: p.booking?.reference ?? "—",
      listingTitle: p.booking?.listing?.title ?? "—",
      amount: p.amount,
      commission: p.commission,
      status: p.status,
      createdAt: p.createdAt,
    }));

    const pendingTotal = filtered
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + (p.amount || 0), 0);
    const netTotal = filtered.reduce((s, p) => s + (p.amount || 0), 0);
    const commissionTotal = filtered.reduce(
      (s, p) => s + (p.commission || 0),
      0,
    );

    return jsonOk({ payouts, pendingTotal, netTotal, commissionTotal });
  } catch (error) {
    return handleRouteError(error);
  }
}
