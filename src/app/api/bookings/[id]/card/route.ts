import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { confirmBookingPaid } from "@/lib/payments";
import { notifyAndEmail } from "@/lib/notify";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  note: z.string().max(500).optional(),
  providerRef: z.string().max(120).optional(),
});

/**
 * Confirm a manual card payment (Admin → Settings → Card = Manual).
 * Provider or admin marks the booking paid after offline card capture.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;

    const access = await getProviderForUser(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!access && !isAdmin) return jsonError("Forbidden", 403);

    const body = schema.parse(await request.json().catch(() => ({})));

    const { data: booking } = await db
      .from("Booking")
      .select(
        "*, listing:Listing(id, title, providerId), traveler:User(id, name, email)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!booking) return jsonError("Not found", 404);

    const listing = booking.listing as {
      id: string;
      title: string;
      providerId: string;
    } | null;
    if (!isAdmin && access?.provider.id !== listing?.providerId) {
      return jsonError("Forbidden", 403);
    }

    if (booking.paymentMethod !== "CARD") {
      return jsonError("This booking is not a card payment", 400);
    }
    if (booking.paymentStatus === "PAID") {
      return jsonError("Card payment already recorded", 400);
    }
    if (["CANCELLED", "NO_SHOW"].includes(booking.status as string)) {
      return jsonError("Cannot confirm card for a cancelled booking", 400);
    }

    const due = booking.totalAmount as number;
    const providerRef =
      body.providerRef?.trim() ||
      `CARD-MANUAL-OK-${session.user.id.slice(-6)}-${Date.now()}`;

    await confirmBookingPaid(id, {
      method: "CARD",
      providerRef,
      amount: due,
      amountReceived: due,
      confirmedById: session.user.id,
      note: body.note || "Card payment confirmed manually",
    });

    await logAudit({
      actor: session.user,
      action: "booking.card_confirmed",
      entityType: "Booking",
      entityId: id,
      summary: `Confirmed manual card payment for ${booking.reference}`,
      metadata: { providerRef, amount: due },
    });

    const traveler = booking.traveler as {
      id?: string;
      email?: string | null;
    } | null;
    await notifyAndEmail({
      userId: (booking.travelerId as string) || traveler?.id,
      email: traveler?.email ?? null,
      type: "payment.card",
      title: `Payment received · ${listing?.title || booking.reference}`,
      body: `Card payment of KES ${due.toLocaleString()} confirmed. View your receipt.`,
      href: `/receipts/${id}`,
    });

    const { data: full } = await db
      .from("Booking")
      .select(
        "*, listing:Listing(*), payments:Payment(*), traveler:User(name, email)",
      )
      .eq("id", id)
      .maybeSingle();

    return jsonOk({ booking: full });
  } catch (error) {
    return handleRouteError(error);
  }
}
