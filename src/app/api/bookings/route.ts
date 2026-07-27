import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bookingAccessToken, bookingReference, createId } from "@/lib/ids";
import { processPayment } from "@/lib/payments";
import { checkRoomAvailability } from "@/lib/availability";
import { autoCompletePastBookings } from "@/lib/bookings";
import { listBookingsForProviderUser } from "@/lib/provider-bookings";
import { getPlatformSettings, boolSetting, numberSetting } from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { breakdownWithVat } from "@/lib/vat";
import { makeReceiptNumber } from "@/lib/receipt";
import { validateKenyanPhone } from "@/lib/identity";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    if (session.user.role === "ADMIN" || session.user.role === "PROVIDER") {
      const bookings = await listBookingsForProviderUser({
        userId: session.user.id,
        role: session.user.role,
      });
      return jsonOk({ bookings });
    }

    await autoCompletePastBookings({ travelerId: session.user.id });
    const { data: bookings, error } = await db
      .from("Booking")
      .select(
        "*, listing:Listing(*, media:Media(*), county:County(*)), roomType:RoomType(*), review:Review(*)",
      )
      .eq("travelerId", session.user.id)
      .order("createdAt", { ascending: false })
      .limit(1, { referencedTable: "listing.media" });
    if (error) throw error;
    return jsonOk({ bookings });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  listingId: z.string(),
  roomTypeId: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string().optional(),
  stayType: z.enum(["OVERNIGHT", "DAYUSE"]).default("OVERNIGHT"),
  dayStartTime: z.string().optional(),
  dayEndTime: z.string().optional(),
  guests: z.number().int().min(1).default(1),
  roomsBooked: z.number().int().min(1).default(1),
  paymentMethod: z.enum(["MPESA", "CARD", "CASH_ON_ARRIVAL"]),
  phone: z.string().optional(),
  notes: z.string().optional(),
  organizationId: z.string().optional(),
  /** Guest checkout (no account) */
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

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = createSchema.parse(await request.json());

    const isMember = Boolean(session?.user);
    let guestName: string | null = null;
    let guestEmail: string | null = null;
    let guestPhone: string | null = null;

    if (!isMember) {
      if (!body.guestName?.trim() || !body.guestEmail?.trim()) {
        return jsonError(
          "Enter your name and email to book as a guest, or log in as a member",
          400,
        );
      }
      guestName = body.guestName.trim();
      guestEmail = body.guestEmail.trim().toLowerCase();
      if (body.guestPhone?.trim()) {
        const phoneResult = validateKenyanPhone(body.guestPhone);
        if (phoneResult.error) return jsonError(phoneResult.error, 400);
        guestPhone = phoneResult.phone;
      } else if (body.phone?.trim()) {
        const phoneResult = validateKenyanPhone(body.phone);
        if (!phoneResult.error) guestPhone = phoneResult.phone;
      }
    } else if (session?.user) {
      guestName = session.user.name || null;
      guestEmail = session.user.email || null;
    }

    const settings = await getPlatformSettings();
    const methodEnabled: Record<string, boolean> = {
      MPESA: boolSetting(settings, "payments.mpesaEnabled"),
      CARD: boolSetting(settings, "payments.cardEnabled"),
      CASH_ON_ARRIVAL: boolSetting(settings, "payments.cashEnabled"),
    };
    if (!methodEnabled[body.paymentMethod]) {
      return jsonError("This payment method is currently unavailable", 400);
    }

    const { data: listing } = await db
      .from("Listing")
      .select("*, roomTypes:RoomType(*)")
      .eq("id", body.listingId)
      .maybeSingle();
    if (!listing || listing.status !== "PUBLISHED") {
      return jsonError("Listing not available", 400);
    }
    const listingRoomTypes = (listing.roomTypes ?? []) as Array<{
      id: string;
      dayUsePrice?: number | null;
      basePrice?: number;
    }>;
    const allowOvernight = listing.allowOvernight !== false;
    const allowDayUse = listing.allowDayUse !== false;
    const stayType = body.stayType ?? "OVERNIGHT";
    if (stayType === "OVERNIGHT" && !allowOvernight) {
      return jsonError("This place does not offer overnight stays", 400);
    }
    if (stayType === "DAYUSE" && !allowDayUse) {
      return jsonError("This place does not offer daytime / day-use stays", 400);
    }

    // Compare calendar days in local time so a YYYY-MM-DD date input is not
    // shifted by UTC (Kenya is UTC+3).
    const toLocalDay = (value: string | Date) => {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      const dt = value instanceof Date ? value : new Date(value);
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };
    const checkInDay = toLocalDay(body.checkIn);
    const today = toLocalDay(new Date());
    if (Number.isNaN(checkInDay.getTime())) {
      return jsonError("Invalid check-in date", 400);
    }
    if (checkInDay < today) {
      return jsonError("Check-in cannot be before today", 400);
    }

    let checkOutDay: Date;
    let nights: number;
    let dayStartTime: string | null = null;
    let dayEndTime: string | null = null;

    if (stayType === "DAYUSE") {
      // Day-use occupies the calendar day for inventory (checkOut = next morning).
      checkOutDay = new Date(checkInDay);
      checkOutDay.setDate(checkOutDay.getDate() + 1);
      nights = 1;
      dayStartTime = body.dayStartTime?.trim() || "10:00";
      dayEndTime = body.dayEndTime?.trim() || "18:00";
      if (dayStartTime >= dayEndTime) {
        return jsonError("Day-use end time must be after start time", 400);
      }
    } else {
      if (!body.checkOut) return jsonError("Check-out date is required", 400);
      checkOutDay = toLocalDay(body.checkOut);
      if (Number.isNaN(checkOutDay.getTime())) {
        return jsonError("Invalid check-out date", 400);
      }
      if (checkOutDay <= checkInDay) {
        return jsonError("Check-out must be after check-in", 400);
      }
      if (checkOutDay < today) {
        return jsonError("Check-out cannot be in the past", 400);
      }
      nights = Math.max(
        1,
        Math.ceil((checkOutDay.getTime() - checkInDay.getTime()) / 86400000),
      );
    }

    let unitPrice = 0;
    const roomTypeId = body.roomTypeId || listingRoomTypes[0]?.id;
    if (roomTypeId) {
      const avail = await checkRoomAvailability({
        roomTypeId,
        checkIn: checkInDay,
        checkOut: checkOutDay,
        roomsBooked: body.roomsBooked,
        dayUse: stayType === "DAYUSE",
      });
      if (!avail.ok) return jsonError(avail.error, 400);
      unitPrice = avail.unitPrice;
    } else {
      unitPrice = 0;
    }

    const subtotalAmount = unitPrice * nights * body.roomsBooked;
    const money = await breakdownWithVat(subtotalAmount);
    const totalAmount = money.total;

    const minAmt = numberSetting(settings, "payments.minBookingAmount");
    const maxAmt = numberSetting(settings, "payments.maxBookingAmount");
    if (minAmt > 0 && totalAmount < minAmt) {
      return jsonError(
        `Minimum booking amount is KES ${minAmt.toLocaleString()}`,
        400,
      );
    }
    if (maxAmt > 0 && totalAmount > maxAmt) {
      return jsonError(
        `Maximum booking amount is KES ${maxAmt.toLocaleString()}`,
        400,
      );
    }

    if (body.paymentMethod === "MPESA" && !listing.acceptMpesa) {
      return jsonError("M-Pesa not accepted", 400);
    }
    if (body.paymentMethod === "CARD" && !listing.acceptCard) {
      return jsonError("Card not accepted", 400);
    }
    if (
      body.paymentMethod === "CASH_ON_ARRIVAL" &&
      !listing.acceptCashOnArrival
    ) {
      return jsonError("Cash on arrival not accepted", 400);
    }

    if (body.paymentMethod === "MPESA" && !body.phone?.trim()) {
      return jsonError("Enter your M-Pesa phone number", 400);
    }

    if (body.paymentMethod === "CARD" && !body.card) {
      return jsonError("Enter your card details to pay", 400);
    }

    const bookingId = createId();
    const reference = bookingReference();
    // Official receipt number only after payment — cash-on-arrival gets it when host confirms.
    const receiptNumber =
      body.paymentMethod === "CASH_ON_ARRIVAL" ? null : makeReceiptNumber();
    const accessToken = bookingAccessToken();
    const now = new Date().toISOString();
    const { error: bookingError } = await db.from("Booking").insert({
      id: bookingId,
      reference,
      listingId: listing.id,
      roomTypeId: roomTypeId || null,
      travelerId: session?.user?.id ?? null,
      guestName,
      guestEmail,
      guestPhone,
      accessToken,
      organizationId: body.organizationId || null,
      checkIn: checkInDay.toISOString(),
      checkOut: checkOutDay.toISOString(),
      stayType,
      dayStartTime,
      dayEndTime,
      guests: body.guests,
      roomsBooked: body.roomsBooked,
      paymentMethod: body.paymentMethod,
      subtotalAmount: money.subtotal,
      vatRate: money.vatRate,
      vatAmount: money.vatAmount,
      totalAmount,
      receiptNumber,
      notes: body.notes ?? null,
      status: "PENDING",
      paymentStatus: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
    if (bookingError) {
      const msg = String(bookingError.message || "");
      if (
        msg.includes("accessToken") ||
        msg.includes("guestEmail") ||
        msg.includes("guestName") ||
        msg.includes("schema cache")
      ) {
        return jsonError(
          "Guest checkout is not set up on the database yet. Run db/2026-guest-checkout.sql in Supabase, then try again.",
          503,
        );
      }
      throw bookingError;
    }

    // Payment (+ loyalty, payout, notifications) is handled inside the payment
    // pipeline so the M-Pesa callback and the sandbox path stay consistent.
    const paid = await processPayment({
      bookingId,
      method: body.paymentMethod,
      amount: totalAmount,
      phone: body.phone,
      reference,
      card: body.card,
    });

    if (paid.paymentStatus === "FAILED") {
      return jsonError(paid.message || "Payment failed", 402);
    }

    const { data: full } = await db
      .from("Booking")
      .select("*, listing:Listing(*), roomType:RoomType(*), payments:Payment(*)")
      .eq("id", bookingId)
      .maybeSingle();

    return jsonOk(
      {
        booking: full,
        payment: paid,
        accessToken,
        receiptUrl: `/receipts/${bookingId}?t=${accessToken}`,
        confirmationUrl: `/bookings/${bookingId}?t=${accessToken}&confirmed=1`,
        guestCheckout: !session?.user,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
