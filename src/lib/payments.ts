import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import {
  getPlatformSettings,
  boolSetting,
  numberSetting,
} from "@/lib/settings";
import {
  explainStkFailure,
  isDarajaConfigured,
  queryStkStatus,
  stkPush,
} from "@/lib/mpesa";
import { notify, notifyAndEmail } from "@/lib/notify";
import { chargeCardSandbox, type CardInput } from "@/lib/card";
import { ensureReceiptNumber } from "@/lib/receipt";
import { normalizePhone } from "@/lib/sms";

export type PaymentMethod = "MPESA" | "CARD" | "CASH_ON_ARRIVAL";

async function updateBooking(
  bookingId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await db
    .from("Booking")
    .update({ ...patch, updatedAt: new Date().toISOString() })
    .eq("id", bookingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Award loyalty points for a paid booking, honouring the Settings toggle. */
async function awardLoyalty(booking: {
  travelerId: string;
  totalAmount: number;
  reference: string;
}) {
  const settings = await getPlatformSettings();
  if (!boolSetting(settings, "flags.loyaltyEnabled")) return;
  const kesPerPoint = numberSetting(settings, "loyalty.kesPerPoint") || 100;
  const pts = Math.floor(booking.totalAmount / kesPerPoint);
  if (pts <= 0) return;

  const { data: existing } = await db
    .from("LoyaltyAccount")
    .select("id, points")
    .eq("userId", booking.travelerId)
    .maybeSingle();
  let accountId: string;
  if (existing) {
    accountId = existing.id as string;
    await db
      .from("LoyaltyAccount")
      .update({ points: (existing.points as number) + pts })
      .eq("id", accountId);
  } else {
    accountId = createId();
    await db
      .from("LoyaltyAccount")
      .insert({ id: accountId, userId: booking.travelerId, points: pts });
  }
  await db.from("LoyaltyLedger").insert({
    id: createId(),
    accountId,
    points: pts,
    reason: `Booking ${booking.reference}`,
  });
}

/**
 * Mark a booking paid + confirmed, create the provider payout, award loyalty,
 * and notify the provider and traveler. Idempotent on the payout (guarded by
 * the unique Payout.bookingId constraint). Shared by card path and M-Pesa STK.
 */
export async function confirmBookingPaid(
  bookingId: string,
  opts: {
    method: PaymentMethod;
    providerRef: string;
    amount?: number;
    amountReceived?: number;
    confirmedById?: string;
    note?: string;
  },
) {
  const { data: bookingState } = await db
    .from("Booking")
    .select("paymentStatus, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (
    bookingState?.paymentStatus === "PAID" &&
    bookingState?.status === "CONFIRMED"
  ) {
    return null;
  }

  const receiptNumber = await ensureReceiptNumber(bookingId);
  const paidAt = new Date().toISOString();
  const amountReceived = opts.amountReceived ?? opts.amount ?? 0;

  const { data: existingPayment } = await db
    .from("Payment")
    .select("id")
    .eq("bookingId", bookingId)
    .eq("status", "PAID")
    .maybeSingle();

  if (!existingPayment) {
    const { data: pending } = await db
      .from("Payment")
      .select("id")
      .eq("bookingId", bookingId)
      .maybeSingle();
    if (pending) {
      await db
        .from("Payment")
        .update({
          status: "PAID",
          providerRef: opts.providerRef,
          receiptNumber,
          amountReceived,
          note: opts.note ?? null,
          amount: opts.amount ?? amountReceived,
          updatedAt: paidAt,
        })
        .eq("id", pending.id as string);
    } else {
      await db.from("Payment").insert({
        id: createId(),
        bookingId,
        method: opts.method,
        status: "PAID",
        amount: opts.amount ?? amountReceived,
        amountReceived,
        providerRef: opts.providerRef,
        receiptNumber,
        note: opts.note ?? null,
      });
    }
  } else {
    await db
      .from("Payment")
      .update({
        receiptNumber,
        amountReceived,
        updatedAt: paidAt,
      })
      .eq("id", existingPayment.id as string);
  }

  await updateBooking(bookingId, {
    paymentStatus: "PAID",
    status: "CONFIRMED",
    receiptNumber,
    amountPaid: amountReceived,
    paidAt,
    paidConfirmedById: opts.confirmedById ?? null,
  });

  const { data: booking, error } = await db
    .from("Booking")
    .select(
      "*, listing:Listing(title, providerId, provider:Provider(name, commissionRate)), traveler:User(name, email)",
    )
    .eq("id", bookingId)
    .single();
  if (error) throw error;

  const listing = booking.listing as {
    title: string;
    providerId: string;
    provider: { name: string; commissionRate: number | null } | null;
  };

  const { data: hasPayout } = await db
    .from("Payout")
    .select("id")
    .eq("bookingId", booking.id)
    .maybeSingle();
  if (!hasPayout) {
    const rate = listing.provider?.commissionRate || 10;
    const commission = Math.round((booking.totalAmount * rate) / 100);
    const amount = booking.totalAmount - commission;
    await db.from("Payout").insert({
      id: createId(),
      providerId: listing.providerId,
      bookingId: booking.id,
      amount,
      commission,
      status: "PENDING",
    });
    if (booking.travelerId) {
      await awardLoyalty({
        travelerId: booking.travelerId as string,
        totalAmount: booking.totalAmount as number,
        reference: booking.reference as string,
      });
    }

    const guestEmail =
      (booking.guestEmail as string | null) ||
      (booking.traveler as { email?: string } | null)?.email ||
      null;
    const guestName =
      (booking.guestName as string | null) ||
      (booking.traveler as { name?: string } | null)?.name ||
      "A guest";
    const token = booking.accessToken as string | null;
    const manageHref = token
      ? `/bookings/${bookingId}?t=${token}&confirmed=1`
      : `/bookings/${bookingId}?confirmed=1`;

    await notifyAndEmail({
      userId: (booking.travelerId as string | null) ?? null,
      email: guestEmail,
      type: "booking.confirmed",
      title: `Booking confirmed · ${listing.title}`,
      body: `Your booking ${booking.reference} is confirmed. Total: KES ${(booking.totalAmount as number).toLocaleString()} (incl. VAT). Receipt ${receiptNumber}. Manage or cancel: ${manageHref}`,
      href: manageHref,
    });
    await notifyProviderOwners(listing.providerId, {
      type: "booking.new",
      title: `New booking · ${listing.title}`,
      body: `${guestName} booked ${booking.reference} (KES ${(booking.totalAmount as number).toLocaleString()}).`,
      href: "/provider/bookings",
    });
  }

  return booking;
}

/**
 * Mark M-Pesa payment failed and cancel the booking so it is never confirmed.
 * Keeps CheckoutRequestID on providerRef; stores reason in note.
 */
export async function failMpesaBooking(
  bookingId: string,
  reason: string,
  opts?: { resultCode?: number | string | null },
) {
  const message = explainStkFailure(opts?.resultCode ?? null, reason);
  const now = new Date().toISOString();

  const { data: payment } = await db
    .from("Payment")
    .select("id, status")
    .eq("bookingId", bookingId)
    .maybeSingle();

  if (payment?.status === "PAID") {
    return { paymentStatus: "PAID", status: "CONFIRMED", message: null };
  }

  if (payment) {
    await db
      .from("Payment")
      .update({
        status: "FAILED",
        note: message,
        updatedAt: now,
      })
      .eq("id", payment.id as string);
  }

  await updateBooking(bookingId, {
    paymentStatus: "FAILED",
    status: "CANCELLED",
    cancellationReason: message,
    cancelledAt: now,
  });

  try {
    const { data: b } = await db
      .from("Booking")
      .select(
        "travelerId, reference, traveler:User(email), listing:Listing(title)",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (b?.travelerId) {
      const listing = b.listing as { title?: string } | null;
      await notifyAndEmail({
        userId: b.travelerId as string,
        email: (b.traveler as { email?: string } | null)?.email ?? null,
        type: "booking.payment_failed",
        title: `M-Pesa payment failed · ${listing?.title || "Booking"}`,
        body: `${message} Reference ${b.reference}.`,
        href: "/account",
      });
    }
  } catch (error) {
    console.error("failMpesaBooking notify failed", error);
  }

  return { paymentStatus: "FAILED", status: "CANCELLED", message };
}

async function notifyProviderOwners(
  providerId: string,
  n: { type: string; title: string; body?: string; href?: string },
) {
  try {
    const { data: members } = await db
      .from("ProviderMember")
      .select("userId")
      .eq("providerId", providerId);
    for (const m of members ?? []) {
      await notify({ userId: m.userId as string, ...n });
    }
  } catch (error) {
    console.error("notifyProviderOwners failed", error);
  }
}

export type ProcessResult = {
  paymentStatus: string;
  status: string;
  pendingMpesa?: boolean;
  message?: string;
  checkoutRequestId?: string;
};

/**
 * Process payment for a freshly-created booking.
 * M-Pesa always sends an STK push; booking confirms only after Safaricom success.
 */
export async function processPayment(opts: {
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  phone?: string;
  reference: string;
  card?: CardInput;
}): Promise<ProcessResult> {
  if (opts.method === "CASH_ON_ARRIVAL") {
    await db.from("Payment").insert({
      id: createId(),
      bookingId: opts.bookingId,
      method: opts.method,
      status: "NOT_REQUIRED",
      amount: opts.amount,
      providerRef: "CASH_ON_ARRIVAL",
    });
    await updateBooking(opts.bookingId, {
      paymentStatus: "NOT_REQUIRED",
      status: "RESERVED",
    });
    const { data: b } = await db
      .from("Booking")
      .select(
        "listing:Listing(title, providerId), guestEmail, guestName, accessToken, travelerId, traveler:User(name, email)",
      )
      .eq("id", opts.bookingId)
      .maybeSingle();
    const l = b?.listing as unknown as {
      title: string;
      providerId: string;
    } | null;
    const traveler = b?.traveler as { name?: string; email?: string } | null;
    const guestName =
      (b?.guestName as string | null) || traveler?.name || "A guest";
    const guestEmail =
      (b?.guestEmail as string | null) || traveler?.email || null;
    if (l) {
      await notifyProviderOwners(l.providerId, {
        type: "booking.reserved",
        title: `New reservation · ${l.title}`,
        body: `${guestName} reserved ${opts.reference} (pay on arrival).`,
        href: "/provider/bookings",
      });
      const token = b?.accessToken as string | null;
      if (guestEmail) {
        await notifyAndEmail({
          userId: (b?.travelerId as string | null) ?? null,
          email: guestEmail,
          type: "booking.reserved",
          title: `Reservation held · ${l.title}`,
          body: `Your reservation ${opts.reference} is held. Pay on arrival — this is not a payment receipt yet. Open your confirmation for details.`,
          href: token
            ? `/bookings/${opts.bookingId}?t=${token}&confirmed=1`
            : `/bookings/${opts.bookingId}?confirmed=1`,
        });
      }
    }
    return { paymentStatus: "NOT_REQUIRED", status: "RESERVED" };
  }

  if (opts.method === "MPESA") {
    if (!(await isDarajaConfigured())) {
      await updateBooking(opts.bookingId, {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        cancellationReason: "M-Pesa is not configured on the platform",
        cancelledAt: new Date().toISOString(),
      });
      return {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        message:
          "M-Pesa is not set up yet. Ask the platform admin to add Daraja credentials under Settings → M-Pesa.",
      };
    }

    const phone = normalizePhone(opts.phone || "");
    if (!phone) {
      await updateBooking(opts.bookingId, {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        cancellationReason: "Invalid M-Pesa phone",
        cancelledAt: new Date().toISOString(),
      });
      return {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        message:
          "Enter a valid Safaricom M-Pesa number (07… or 2547…). Booking was not confirmed.",
      };
    }

    await db.from("Payment").insert({
      id: createId(),
      bookingId: opts.bookingId,
      method: "MPESA",
      status: "PENDING",
      amount: opts.amount,
      providerRef: null,
      note: null,
    });

    const stk = await stkPush({
      phone,
      amount: opts.amount,
      reference: opts.reference,
      description: `Booking ${opts.reference}`,
    });

    if (!stk.ok) {
      const failed = await failMpesaBooking(
        opts.bookingId,
        stk.error || "STK push failed",
      );
      return {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        message: failed.message || stk.error || "M-Pesa request failed",
      };
    }

    if (stk.checkoutRequestId) {
      await db
        .from("Payment")
        .update({
          providerRef: stk.checkoutRequestId,
          updatedAt: new Date().toISOString(),
        })
        .eq("bookingId", opts.bookingId);
    }

    return {
      paymentStatus: "PENDING",
      status: "PENDING",
      pendingMpesa: true,
      checkoutRequestId: stk.checkoutRequestId,
      message:
        "An M-Pesa prompt was sent to your phone. Enter your PIN to pay. Your booking confirms only after payment succeeds.",
    };
  }

  if (opts.method === "CARD") {
    if (!opts.card) {
      return {
        paymentStatus: "FAILED",
        status: "PENDING",
        message: "Enter your card details to pay",
      };
    }
    const settings = await getPlatformSettings();
    const cardMode = String(settings["payments.cardMode"] || "sandbox");

    if (cardMode === "manual") {
      await db.from("Payment").insert({
        id: createId(),
        bookingId: opts.bookingId,
        method: "CARD",
        status: "PENDING",
        amount: opts.amount,
        providerRef: `CARD-MANUAL-${opts.reference}`,
        note: "Awaiting manual card confirmation",
      });
      await updateBooking(opts.bookingId, {
        paymentStatus: "PENDING",
        status: "PENDING",
      });
      return {
        paymentStatus: "PENDING",
        status: "PENDING",
        message:
          "Card details received. An admin will confirm payment shortly — booking is not confirmed yet.",
      };
    }

    const charged = chargeCardSandbox(opts.card, {
      amount: opts.amount,
      reference: opts.reference,
    });
    if (!charged.ok) {
      await db.from("Payment").insert({
        id: createId(),
        bookingId: opts.bookingId,
        method: "CARD",
        status: "FAILED",
        amount: opts.amount,
        providerRef: charged.error.slice(0, 120),
      });
      await updateBooking(opts.bookingId, {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        cancellationReason: charged.error,
        cancelledAt: new Date().toISOString(),
      });
      return {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        message: charged.error,
      };
    }
    await confirmBookingPaid(opts.bookingId, {
      method: "CARD",
      providerRef: charged.providerRef,
      amount: opts.amount,
    });
    return {
      paymentStatus: "PAID",
      status: "CONFIRMED",
      message: `Paid with ${charged.brand} ···· ${charged.last4}`,
    };
  }

  return {
    paymentStatus: "FAILED",
    status: "CANCELLED",
    message: "Unsupported payment method",
  };
}

export async function findBookingByCheckoutId(
  checkoutRequestId: string,
): Promise<{ bookingId: string; amount: number } | null> {
  const { data } = await db
    .from("Payment")
    .select("bookingId, amount")
    .eq("providerRef", checkoutRequestId)
    .maybeSingle();
  if (!data) return null;
  return { bookingId: data.bookingId as string, amount: data.amount as number };
}

/**
 * Poll payment status. If still PENDING, query Daraja so success/failure applies
 * even when the STK callback is delayed.
 */
export async function refreshMpesaPaymentStatus(bookingId: string): Promise<{
  paymentStatus: string;
  status: string;
  message: string | null;
  reference?: string;
  receiptNumber?: string | null;
}> {
  const { data: booking, error } = await db
    .from("Booking")
    .select(
      "id, reference, status, paymentStatus, receiptNumber, payments:Payment(id, status, providerRef, note, method, amount)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) {
    return {
      paymentStatus: "FAILED",
      status: "CANCELLED",
      message: "Booking not found",
    };
  }

  const paymentRaw = booking.payments;
  const payment = Array.isArray(paymentRaw) ? paymentRaw[0] : paymentRaw;

  if (booking.paymentStatus === "PAID") {
    return {
      paymentStatus: "PAID",
      status: booking.status as string,
      message: "Payment received. Booking confirmed.",
      reference: booking.reference as string,
      receiptNumber: booking.receiptNumber as string | null,
    };
  }

  if (booking.paymentStatus === "FAILED") {
    return {
      paymentStatus: "FAILED",
      status: booking.status as string,
      message:
        (payment as { note?: string } | null)?.note ||
        "M-Pesa payment failed. Booking was not confirmed.",
      reference: booking.reference as string,
    };
  }

  const checkoutId = (payment as { providerRef?: string } | null)?.providerRef;
  if (
    booking.paymentStatus === "PENDING" &&
    payment &&
    (payment as { method?: string }).method === "MPESA" &&
    checkoutId
  ) {
    const q = await queryStkStatus(checkoutId);
    if (!("error" in q) && q.done) {
      if (q.success) {
        await confirmBookingPaid(bookingId, {
          method: "MPESA",
          providerRef: checkoutId,
          amount: (payment as { amount?: number }).amount,
        });
        const { data: updated } = await db
          .from("Booking")
          .select("status, paymentStatus, receiptNumber, reference")
          .eq("id", bookingId)
          .single();
        return {
          paymentStatus: "PAID",
          status: (updated?.status as string) || "CONFIRMED",
          message: "Payment received. Booking confirmed.",
          reference:
            (updated?.reference as string) || (booking.reference as string),
          receiptNumber: (updated?.receiptNumber as string) || null,
        };
      }
      const failed = await failMpesaBooking(bookingId, q.resultDesc, {
        resultCode: q.resultCode,
      });
      return {
        paymentStatus: "FAILED",
        status: "CANCELLED",
        message: failed.message,
        reference: booking.reference as string,
      };
    }
  }

  return {
    paymentStatus: "PENDING",
    status: "PENDING",
    message:
      "Waiting for M-Pesa… Enter your PIN on the phone prompt. Booking confirms only after payment succeeds.",
    reference: booking.reference as string,
  };
}
