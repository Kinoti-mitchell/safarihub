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
  amountPaid: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

/**
 * Provider confirms cash-on-arrival payment: enter the amount the guest paid,
 * mark booking PAID + CONFIRMED, issue/keep receipt, create payout.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;

    const access = await getProviderForUser(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!access && !isAdmin) return jsonError("Forbidden", 403);

    const body = schema.parse(await request.json());

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

    if (booking.paymentMethod !== "CASH_ON_ARRIVAL") {
      return jsonError("This booking is not cash on arrival", 400);
    }
    if (booking.paymentStatus === "PAID") {
      return jsonError("Cash payment already recorded", 400);
    }
    if (["CANCELLED", "NO_SHOW"].includes(booking.status as string)) {
      return jsonError("Cannot collect cash for a cancelled booking", 400);
    }

    const due = booking.totalAmount as number;
    if (body.amountPaid < due) {
      return jsonError(
        `Amount paid (KES ${body.amountPaid.toLocaleString()}) is less than the amount due (KES ${due.toLocaleString()})`,
        400,
      );
    }

    // Flip any NOT_REQUIRED cash placeholder to pending so confirmBookingPaid can update it.
    await db
      .from("Payment")
      .update({ status: "PENDING", updatedAt: new Date().toISOString() })
      .eq("bookingId", id)
      .eq("status", "NOT_REQUIRED");

    await confirmBookingPaid(id, {
      method: "CASH_ON_ARRIVAL",
      providerRef: `CASH-${session.user.id.slice(-6)}-${Date.now()}`,
      amount: due,
      amountReceived: body.amountPaid,
      confirmedById: session.user.id,
      note:
        body.note ||
        (body.amountPaid > due
          ? `Cash received KES ${body.amountPaid.toLocaleString()} (change KES ${(body.amountPaid - due).toLocaleString()})`
          : "Cash received on arrival"),
    });

    await logAudit({
      actor: session.user,
      action: "booking.cash_collected",
      entityType: "Booking",
      entityId: id,
      summary: `Collected cash KES ${body.amountPaid.toLocaleString()} for ${booking.reference} (due KES ${due.toLocaleString()})`,
      metadata: { amountPaid: body.amountPaid, due },
    });

    const traveler = booking.traveler as {
      id?: string;
      email?: string | null;
    } | null;
    await notifyAndEmail({
      userId: (booking.travelerId as string) || traveler?.id,
      email: traveler?.email ?? null,
      type: "payment.cash",
      title: `Payment received · ${listing?.title || booking.reference}`,
      body: `Cash payment of KES ${body.amountPaid.toLocaleString()} recorded. View your receipt.`,
      href: `/receipts/${id}`,
    });

    const { data: full } = await db
      .from("Booking")
      .select("*, listing:Listing(*), payments:Payment(*), traveler:User(name, email)")
      .eq("id", id)
      .maybeSingle();

    return jsonOk({ booking: full });
  } catch (error) {
    return handleRouteError(error);
  }
}
