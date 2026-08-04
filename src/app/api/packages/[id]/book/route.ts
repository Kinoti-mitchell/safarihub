import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bookingAccessToken, bookingReference, createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { breakdownWithVat } from "@/lib/vat";
import { makeReceiptNumber } from "@/lib/receipt";
import { chargeCardSandbox } from "@/lib/card";
import { notifyAndEmail } from "@/lib/notify";
import { getPlatformSettings, boolSetting } from "@/lib/settings";
import { validateKenyanPhone } from "@/lib/identity";
import { isDarajaConfigured, stkPush } from "@/lib/mpesa";
import { normalizePhone } from "@/lib/sms";
import { failMpesaPackageBooking } from "@/lib/payments";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const bookSchema = z.object({
  startDate: z.string().min(8),
  guests: z.number().int().min(1).default(2),
  paymentMethod: z.enum(["MPESA", "CARD", "CASH_ON_ARRIVAL"]),
  phone: z.string().optional(),
  notes: z.string().max(500).optional(),
  guestName: z.string().min(2).max(120).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  card: z
    .object({
      number: z.string().min(12),
      name: z.string().min(2),
      expiry: z.string().min(4),
      cvc: z.string().min(3).max(4),
    })
    .optional(),
});

/**
 * Book a published travel package (guest or member).
 * M-Pesa sends an STK push; booking confirms only after Safaricom success.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = bookSchema.parse(await request.json());

    const { data: pkg } = await db
      .from("TravelPackage")
      .select("*, items:PackageItem(*)")
      .eq("id", id)
      .eq("isPublished", true)
      .maybeSingle();
    if (!pkg) return jsonError("Package not found", 404);

    let travelerId: string | null = session?.user?.id ?? null;

    // Prefer checkout-form details; fall back to member profile if blank.
    const guestName =
      body.guestName?.trim() ||
      session?.user?.name?.trim() ||
      null;
    const guestEmailRaw =
      body.guestEmail?.trim() || session?.user?.email?.trim() || null;
    const guestEmail = guestEmailRaw ? guestEmailRaw.toLowerCase() : null;

    if (!guestName || !guestEmail) {
      return jsonError("Name and email are required to complete booking", 400);
    }

    let guestPhone: string | null = body.guestPhone?.trim() || null;
    if (guestPhone) {
      const phoneCheck = validateKenyanPhone(guestPhone, { required: true });
      if (phoneCheck.error) return jsonError(phoneCheck.error, 400);
      guestPhone = phoneCheck.phone;
    }

    const settings = await getPlatformSettings();
    if (
      body.paymentMethod === "MPESA" &&
      !boolSetting(settings, "payments.mpesaEnabled")
    ) {
      return jsonError("M-Pesa is disabled", 400);
    }
    if (
      body.paymentMethod === "CARD" &&
      !boolSetting(settings, "payments.cardEnabled")
    ) {
      return jsonError("Card payments are disabled", 400);
    }

    const money = await breakdownWithVat(pkg.price as number);
    const bookingId = createId();
    const reference = bookingReference();
    const accessToken = bookingAccessToken();
    const startDay = body.startDate.slice(0, 10);
    const startDate = `${startDay}T12:00:00.000Z`;
    const confirmHref = `/packages/bookings/${bookingId}?t=${accessToken}&confirmed=1`;

    let paymentStatus: string = "PENDING";
    let status: string = "PENDING";
    let amountPaid: number | null = null;
    let paidAt: string | null = null;
    let receiptNumber: string | null = null;
    let paymentMessage = "";
    let pendingMpesa = false;
    let checkoutRequestId: string | undefined;

    if (body.paymentMethod === "CASH_ON_ARRIVAL") {
      paymentStatus = "NOT_REQUIRED";
      status = "RESERVED";
      paymentMessage = "Package reserved — pay on arrival / with your host";
    } else if (body.paymentMethod === "CARD") {
      if (!body.card) return jsonError("Card details required", 400);
      const cardMode = String(settings["payments.cardMode"] || "sandbox");
      if (cardMode === "manual") {
        paymentStatus = "PENDING";
        status = "PENDING";
        paymentMessage =
          "Card details received. An admin will confirm payment shortly — package is not confirmed yet.";
      } else {
        const charged = chargeCardSandbox(body.card, {
          amount: money.total,
          reference,
        });
        if (!charged.ok) return jsonError(charged.error || "Card failed", 402);
        paymentStatus = "PAID";
        status = "CONFIRMED";
        amountPaid = money.total;
        paidAt = new Date().toISOString();
        receiptNumber = makeReceiptNumber();
        paymentMessage = "Card payment received";
      }
    } else {
      const rawPhone = body.phone || guestPhone;
      if (!rawPhone) return jsonError("M-Pesa phone number required", 400);
      const phoneCheck = validateKenyanPhone(rawPhone, { required: true });
      if (phoneCheck.error) return jsonError(phoneCheck.error, 400);
      paymentStatus = "PENDING";
      status = "PENDING";
      paymentMessage =
        "An M-Pesa prompt was sent to your phone. Enter your PIN to pay. Your package confirms only after payment succeeds.";
    }

    const { data: row, error } = await db
      .from("PackageBooking")
      .insert({
        id: bookingId,
        reference,
        packageId: id,
        travelerId,
        guestName,
        guestEmail,
        guestPhone,
        accessToken,
        startDate,
        guests: body.guests,
        status,
        paymentMethod: body.paymentMethod,
        paymentStatus,
        subtotalAmount: money.subtotal,
        vatRate: money.vatRate,
        vatAmount: money.vatAmount,
        totalAmount: money.total,
        amountPaid,
        paidAt,
        receiptNumber,
        notes: body.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      const msg = error.message || "";
      if (msg.includes("PackageBooking") || msg.includes("does not exist")) {
        return jsonError(
          "Package bookings need migration db/2026-tourist-essentials.sql applied",
          503,
        );
      }
      throw error;
    }

    if (body.paymentMethod === "CARD" && paymentStatus === "PENDING") {
      await db.from("Payment").insert({
        id: createId(),
        bookingId: null,
        packageBookingId: bookingId,
        method: "CARD",
        status: "PENDING",
        amount: money.total,
        providerRef: `CARD-MANUAL-${reference}`,
        note: "Awaiting manual card confirmation",
      });
    }

    if (body.paymentMethod === "CARD" && paymentStatus === "PAID") {
      await db.from("Payment").insert({
        id: createId(),
        bookingId: null,
        packageBookingId: bookingId,
        method: "CARD",
        status: "PAID",
        amount: money.total,
        amountReceived: money.total,
        providerRef: `CARD-${reference}`,
        receiptNumber,
      });
    }

    if (body.paymentMethod === "MPESA") {
      if (!(await isDarajaConfigured())) {
        await failMpesaPackageBooking(
          bookingId,
          "M-Pesa is not configured on the platform",
        );
        return jsonError(
          "M-Pesa is not set up yet. Ask the platform admin to add Daraja credentials under Settings → M-Pesa.",
          503,
        );
      }

      const phone = normalizePhone(body.phone || guestPhone || "");
      if (!phone) {
        await failMpesaPackageBooking(bookingId, "Invalid M-Pesa phone");
        return jsonError(
          "Enter a valid Safaricom M-Pesa number (07… or 2547…). Booking was not confirmed.",
          400,
        );
      }

      await db.from("Payment").insert({
        id: createId(),
        bookingId: null,
        packageBookingId: bookingId,
        method: "MPESA",
        status: "PENDING",
        amount: money.total,
        providerRef: null,
        note: null,
      });

      const stk = await stkPush({
        phone,
        amount: money.total,
        reference,
        description: `Package ${reference}`,
      });

      if (!stk.ok) {
        const failed = await failMpesaPackageBooking(
          bookingId,
          stk.error || "STK push failed",
        );
        return jsonError(
          failed.message || stk.error || "M-Pesa request failed",
          402,
        );
      }

      checkoutRequestId = stk.checkoutRequestId;
      pendingMpesa = true;

      if (stk.checkoutRequestId) {
        await db
          .from("Payment")
          .update({
            providerRef: stk.checkoutRequestId,
            updatedAt: new Date().toISOString(),
          })
          .eq("packageBookingId", bookingId);

        {
          const { error: checkoutColErr } = await db
            .from("PackageBooking")
            .update({
              mpesaCheckoutId: stk.checkoutRequestId,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", bookingId);
          // Ignore if mpesaCheckoutId column is missing (pre-migration)
          if (checkoutColErr) {
            console.warn(
              "PackageBooking.mpesaCheckoutId update skipped",
              checkoutColErr.message,
            );
          }
        }
      }

      paymentMessage =
        "An M-Pesa prompt was sent to your phone. Enter your PIN to pay. Your package confirms only after payment succeeds.";
    }

    // Notify immediately for cash / confirmed card; M-Pesa waits for callback
    if (guestEmail && !pendingMpesa) {
      await notifyAndEmail({
        userId: travelerId,
        email: guestEmail,
        type:
          status === "CONFIRMED" ? "package.confirmed" : "package.reserved",
        title: `${status === "CONFIRMED" ? "Package confirmed" : "Package reserved"} · ${pkg.title}`,
        body: `Reference ${reference}. ${paymentMessage} Total KES ${money.total.toLocaleString()}.`,
        href: confirmHref,
      });
    }

    return jsonOk(
      {
        booking: row,
        payment: {
          message: paymentMessage,
          paymentStatus: pendingMpesa ? "PENDING" : paymentStatus,
          status: pendingMpesa ? "PENDING" : status,
          pendingMpesa: pendingMpesa || undefined,
        },
        pendingMpesa: pendingMpesa || undefined,
        checkoutRequestId,
        accessToken,
        confirmationUrl: confirmHref,
        guestCheckout: !session?.user,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
