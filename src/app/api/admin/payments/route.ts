import { db } from "@/lib/supabase";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { refreshMpesaPaymentStatus } from "@/lib/payments";

const STUCK_MINUTES = 15;

export async function GET(request: Request) {
  try {
    await requireAdminPermission("payout.manage");
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "exceptions";

    const cutoff = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();

    if (tab === "refunds") {
      const { data, error } = await db
        .from("Refund")
        .select(
          "*, booking:Booking(reference, guestName, paymentMethod, listing:Listing(title))",
        )
        .order("createdAt", { ascending: false })
        .limit(100);
      if (error) throw error;
      return jsonOk({ refunds: data ?? [] });
    }

    if (tab === "events") {
      const { data, error } = await db
        .from("PaymentEvent")
        .select("*")
        .order("createdAt", { ascending: false })
        .limit(150);
      if (error) throw error;
      return jsonOk({ events: data ?? [] });
    }

    // Exceptions: stuck PENDING M-Pesa, FAILED payments, PROCESSING refunds, B2C PROCESSING payouts
    const [pendingPay, failedPay, processingRefunds, processingPayouts] =
      await Promise.all([
        db
          .from("Payment")
          .select(
            "id, bookingId, method, status, amount, providerRef, note, createdAt, updatedAt, booking:Booking(reference, status, paymentStatus, guestName, guestPhone, listing:Listing(title))",
          )
          .eq("status", "PENDING")
          .eq("method", "MPESA")
          .lt("createdAt", cutoff)
          .order("createdAt", { ascending: true })
          .limit(80),
        db
          .from("Payment")
          .select(
            "id, bookingId, method, status, amount, providerRef, note, createdAt, updatedAt, booking:Booking(reference, status, paymentStatus, guestName, guestPhone, listing:Listing(title))",
          )
          .eq("status", "FAILED")
          .order("updatedAt", { ascending: false })
          .limit(40),
        db
          .from("Refund")
          .select(
            "id, bookingId, amount, method, status, errorMessage, createdAt, booking:Booking(reference)",
          )
          .in("status", ["PENDING", "PROCESSING", "FAILED"])
          .order("createdAt", { ascending: false })
          .limit(40),
        db
          .from("Payout")
          .select(
            "id, bookingId, amount, status, b2cConversationId, b2cResultDesc, holdReason, createdAt, provider:Provider(name, payoutPhone, phone)",
          )
          .in("status", ["PROCESSING", "ON_HOLD", "FAILED"])
          .order("updatedAt", { ascending: false })
          .limit(40),
      ]);

    for (const res of [
      pendingPay,
      failedPay,
      processingRefunds,
      processingPayouts,
    ]) {
      if (res.error) throw res.error;
    }

    return jsonOk({
      stuckMinutes: STUCK_MINUTES,
      stuckMpesa: pendingPay.data ?? [],
      failedPayments: failedPay.data ?? [],
      openRefunds: processingRefunds.data ?? [],
      payoutExceptions: processingPayouts.data ?? [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("payout.manage");
    const body = (await request.json()) as {
      action?: string;
      bookingId?: string;
      paymentId?: string;
      refundId?: string;
    };

    if (body.action === "requery" && body.bookingId) {
      const result = await refreshMpesaPaymentStatus(body.bookingId);
      return jsonOk({ result });
    }

    if (body.action === "confirm_paid" && body.bookingId) {
      const { confirmBookingPaid } = await import("@/lib/payments");
      await confirmBookingPaid(body.bookingId, {
        method: "MPESA",
        providerRef: `ADMIN-CONFIRM-${Date.now()}`,
        confirmedById: admin.id,
        note: "Manually confirmed from payments exception desk",
      });
      const { recordPaymentEvent } = await import("@/lib/payment-events");
      await recordPaymentEvent({
        kind: "EXCEPTION_RESOLVED",
        bookingId: body.bookingId,
        status: "PAID",
        actorId: admin.id,
        note: "Admin confirmed paid from exception desk",
      });
      return jsonOk({ ok: true });
    }

    if (body.action === "refund" && body.bookingId) {
      const { requestBookingRefund } = await import("@/lib/refunds");
      const result = await requestBookingRefund({
        bookingId: body.bookingId,
        actorId: admin.id,
        actor: admin,
        method: "MPESA_REVERSAL",
        note: "Refund from payments exception desk",
      });
      if (!result.ok) {
        const { jsonError } = await import("@/lib/http");
        return jsonError(result.error, result.status);
      }
      return jsonOk(result);
    }

    if (body.action === "mark_refund_done" && body.refundId) {
      const { markRefundCompleted } = await import("@/lib/refunds");
      const result = await markRefundCompleted({
        refundId: body.refundId,
        actor: admin,
        note: "Marked completed from exception desk",
      });
      if (!result.ok) {
        const { jsonError } = await import("@/lib/http");
        return jsonError(result.error, result.status);
      }
      return jsonOk(result);
    }

    const { jsonError } = await import("@/lib/http");
    return jsonError("Unknown action", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}
