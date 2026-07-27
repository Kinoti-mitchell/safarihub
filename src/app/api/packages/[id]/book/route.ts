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
 * Payments: cash reserve, card sandbox, or M-Pesa phone capture (manual confirm
 * when Daraja isn't wired for package ledger).
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

    let guestName: string | null = null;
    let guestEmail: string | null = null;
    let guestPhone: string | null = null;
    let travelerId: string | null = null;

    if (!session?.user) {
      if (!body.guestName?.trim() || !body.guestEmail?.trim()) {
        return jsonError("Name and email are required for guest checkout", 400);
      }
      guestName = body.guestName.trim();
      guestEmail = body.guestEmail.trim().toLowerCase();
      guestPhone = body.guestPhone?.trim() || null;
      if (guestPhone) {
        const phoneCheck = validateKenyanPhone(guestPhone, { required: true });
        if (phoneCheck.error) return jsonError(phoneCheck.error, 400);
        guestPhone = phoneCheck.phone;
      }
    } else {
      travelerId = session.user.id;
      guestName = session.user.name || body.guestName || "Guest";
      guestEmail = session.user.email || body.guestEmail || null;
      guestPhone = body.guestPhone?.trim() || null;
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

    let paymentStatus: string = "PENDING";
    let status: string = "PENDING";
    let amountPaid: number | null = null;
    let paidAt: string | null = null;
    let receiptNumber: string | null = null;
    let paymentMessage = "";

    if (body.paymentMethod === "CASH_ON_ARRIVAL") {
      paymentStatus = "NOT_REQUIRED";
      status = "RESERVED";
      paymentMessage = "Package reserved — pay on arrival / with your host";
    } else if (body.paymentMethod === "CARD") {
      if (!body.card) return jsonError("Card details required", 400);
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
    } else {
      const phone = body.phone || guestPhone;
      if (!phone) return jsonError("M-Pesa phone number required", 400);
      const phoneCheck = validateKenyanPhone(phone, { required: true });
      if (phoneCheck.error) return jsonError(phoneCheck.error, 400);
      paymentStatus = "PENDING";
      status = "RESERVED";
      paymentMessage =
        "Package held. Complete M-Pesa payment when prompted, or pay via the confirmation link instructions.";
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

    const confirmHref = `/packages/bookings/${bookingId}?t=${accessToken}&confirmed=1`;
    if (guestEmail) {
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
        payment: { message: paymentMessage, paymentStatus, status },
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
