import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];

export async function GET(request: Request) {
  try {
    await requireAdminPermission("booking.confirm");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const status =
      statusParam && STATUSES.includes(statusParam) ? statusParam : undefined;

    let query = db
      .from("Booking")
      .select(
        "id, reference, checkIn, checkOut, guests, status, paymentMethod, paymentStatus, totalAmount, createdAt, listing:Listing(title, provider:Provider(name)), traveler:User(name, email)",
      )
      .order("createdAt", { ascending: false })
      .limit(200);
    if (status) query = query.eq("status", status);
    if (q) {
      // Reference match only — PostgREST cannot filter embedded relations here.
      query = query.ilike("reference", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      reference: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      status: string;
      paymentMethod: string;
      paymentStatus: string;
      totalAmount: number;
      createdAt: string;
      listing: { title: string; provider: { name: string } | null } | null;
      traveler: { name: string | null; email: string } | null;
    }>;

    const bookings = rows.map((b) => ({
      id: b.id,
      reference: b.reference,
      listingTitle: b.listing?.title ?? "—",
      providerName: b.listing?.provider?.name ?? "—",
      travelerName: b.traveler?.name ?? null,
      travelerEmail: b.traveler?.email ?? "—",
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      guests: b.guests,
      status: b.status,
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount,
      createdAt: b.createdAt,
    }));

    const revenue = rows
      .filter(
        (b) => b.paymentStatus === "PAID" || b.paymentStatus === "NOT_REQUIRED",
      )
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    return jsonOk({
      bookings,
      total: bookings.length,
      revenue,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
