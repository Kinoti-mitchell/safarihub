import { sendEmail, appUrl } from "@/lib/email";
import { notify } from "@/lib/notify";
import { getPlatformName } from "@/lib/branding";
import { boolSetting, getPlatformSettings } from "@/lib/settings";
import { getPlatformTimezone } from "@/lib/datetime";

export type BookingEmailPayload = {
  id: string;
  reference: string;
  status: string;
  checkIn: string;
  checkOut: string;
  stayType?: string | null;
  dayStartTime?: string | null;
  dayEndTime?: string | null;
  guests?: number | null;
  roomsBooked?: number | null;
  totalAmount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  travelerId?: string | null;
  accessToken?: string | null;
  listingTitle?: string | null;
  roomName?: string | null;
  travelerEmail?: string | null;
  travelerName?: string | null;
};

function formatStayDay(value: string, timeZone: string): string {
  const day = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return new Date(value).toLocaleDateString("en-KE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "CASH_ON_ARRIVAL":
      return "Cash on arrival";
    case "MPESA":
      return "M-Pesa";
    case "CARD":
      return "Card";
    default:
      return method?.replace(/_/g, " ") || "—";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function guestContact(b: BookingEmailPayload) {
  return {
    name: b.guestName || b.travelerName || "Guest",
    email: b.guestEmail || b.travelerEmail || null,
  };
}

function manageHref(b: BookingEmailPayload): string {
  if (b.accessToken) {
    return `/bookings/${b.id}?t=${encodeURIComponent(b.accessToken)}&confirmed=1`;
  }
  if (b.travelerId) return "/account";
  return `/bookings/${b.id}`;
}

/**
 * Email the tourist when the host confirms their booking.
 * Best-effort — never throws.
 */
export async function emailTouristBookingConfirmed(
  booking: BookingEmailPayload,
): Promise<boolean> {
  const guest = guestContact(booking);
  if (!guest.email) {
    console.info(
      `[booking-email] skip confirm — no guest email for ${booking.reference}`,
    );
    return false;
  }

  const settings = await getPlatformSettings();
  if (!boolSetting(settings, "notifications.emailOnBooking")) {
    if (booking.travelerId) {
      await notify({
        userId: booking.travelerId,
        type: "booking.confirmed",
        title: `Booking confirmed · ${booking.listingTitle || "your stay"}`,
        body: `Your booking ${booking.reference} is confirmed.`,
        href: manageHref(booking),
      });
    }
    return false;
  }

  const timeZone = await getPlatformTimezone();
  const listing = booking.listingTitle || "your stay";
  const isDayUse = booking.stayType === "DAYUSE";
  const stayLine = isDayUse
    ? `${formatStayDay(booking.checkIn, timeZone)}${
        booking.dayStartTime
          ? ` · ${booking.dayStartTime}–${booking.dayEndTime || ""}`
          : ""
      }`
    : `${formatStayDay(booking.checkIn, timeZone)} → ${formatStayDay(booking.checkOut, timeZone)}`;
  const rooms = booking.roomsBooked ?? 1;
  const guests = booking.guests ?? 1;
  const total =
    booking.totalAmount != null
      ? `KES ${Math.round(booking.totalAmount).toLocaleString()}`
      : "—";
  const href = manageHref(booking);
  const link = appUrl(href);

  const platformName = await getPlatformName();
  const subject = `Booking confirmed · ${listing}`;
  const text = [
    `Hi ${guest.name},`,
    ``,
    `Good news — your booking has been confirmed by the host.`,
    ``,
    `Reference: ${booking.reference}`,
    `Listing: ${listing}`,
    booking.roomName ? `Room / offer: ${booking.roomName}` : null,
    `Stay: ${stayLine}`,
    `Rooms: ${rooms}`,
    `Guests: ${guests}`,
    `Payment: ${paymentMethodLabel(booking.paymentMethod)} (${(booking.paymentStatus || "").replace(/_/g, " ") || "—"})`,
    `Total: ${total}`,
    ``,
    `View or manage your booking:`,
    link,
    ``,
    `— ${platformName}`,
  ]
    .filter((line) => line != null)
    .join("\n");

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1c1712">
      <p style="font-size:15px">Hi ${escapeHtml(guest.name)},</p>
      <p style="font-size:15px">Good news — your booking has been <strong>confirmed by the host</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#6b635b">Reference</td><td style="padding:8px 0;text-align:right;font-weight:600">${escapeHtml(booking.reference)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b635b">Listing</td><td style="padding:8px 0;text-align:right">${escapeHtml(listing)}</td></tr>
        ${
          booking.roomName
            ? `<tr><td style="padding:8px 0;color:#6b635b">Room / offer</td><td style="padding:8px 0;text-align:right">${escapeHtml(booking.roomName)}</td></tr>`
            : ""
        }
        <tr><td style="padding:8px 0;color:#6b635b">Stay</td><td style="padding:8px 0;text-align:right">${escapeHtml(stayLine)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b635b">Rooms</td><td style="padding:8px 0;text-align:right">${rooms}</td></tr>
        <tr><td style="padding:8px 0;color:#6b635b">Guests</td><td style="padding:8px 0;text-align:right">${guests}</td></tr>
        <tr><td style="padding:8px 0;color:#6b635b">Payment</td><td style="padding:8px 0;text-align:right">${escapeHtml(paymentMethodLabel(booking.paymentMethod))}</td></tr>
        <tr><td style="padding:8px 0;color:#6b635b">Total</td><td style="padding:8px 0;text-align:right;font-weight:600">${escapeHtml(total)}</td></tr>
      </table>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#1a4d4a;color:#f5efe6;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600">
          View confirmation
        </a>
      </p>
      <p style="font-size:12px;color:#6b635b">Powered by ${escapeHtml(platformName)}</p>
    </div>
  `;

  try {
    if (booking.travelerId) {
      await notify({
        userId: booking.travelerId,
        type: "booking.confirmed",
        title: subject,
        body: `Your booking ${booking.reference} for ${listing} is confirmed.`,
        href,
      });
    }
    return await sendEmail({
      to: guest.email,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("emailTouristBookingConfirmed failed", error);
    return false;
  }
}
