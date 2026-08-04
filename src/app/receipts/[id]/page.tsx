import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { brandFromSettings } from "@/lib/branding";
import { formatKes } from "@/lib/vat";
import { ReceiptPrintButton } from "@/components/receipt-print-button";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
};

/** Calendar day from a stored timestamp, without UTC day-shift. */
function formatStayDay(value: string): string {
  const day = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return new Date(value).toLocaleDateString("en-KE", {
    timeZone: "Africa/Nairobi",
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
      return method || "—";
  }
}

function paymentStatusLabel(
  status: string | null | undefined,
  method: string | null | undefined,
): string {
  if (method === "CASH_ON_ARRIVAL" && status === "NOT_REQUIRED") {
    return "Pay on arrival";
  }
  switch (status) {
    case "PAID":
      return "Paid";
    case "PENDING":
      return "Payment pending";
    case "FAILED":
      return "Payment failed";
    case "NOT_REQUIRED":
      return "No online payment";
    default:
      return status || "—";
  }
}

export default async function ReceiptPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { t: token } = await searchParams;
  const session = await auth();

  const { data: booking } = await db
    .from("Booking")
    .select(
      "*, listing:Listing(title, address, provider:Provider(name, email, phone)), roomType:RoomType(name), traveler:User(name, email, phone), payments:Payment(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const tokenOk =
    Boolean(token) &&
    Boolean(booking.accessToken) &&
    token === (booking.accessToken as string);

  let allowed = tokenOk;
  if (!allowed && session?.user) {
    const access = await getProviderForUser(session.user.id);
    const listingRow = await db
      .from("Listing")
      .select("providerId")
      .eq("id", booking.listingId as string)
      .maybeSingle();
    const isTraveler = booking.travelerId === session.user.id;
    const isProvider =
      !!access && listingRow.data?.providerId === access.provider.id;
    const isAdmin = session.user.role === "ADMIN";
    allowed = isTraveler || isProvider || isAdmin;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-muted">
          Sign in to view this booking, or open the link from your email.
        </p>
        <Link
          href={`/login?callbackUrl=/receipts/${id}`}
          className="mt-4 inline-block text-lake-bright underline"
        >
          Log in
        </Link>
      </div>
    );
  }

  const brand = await brandFromSettings();
  const listing = booking.listing as {
    title: string;
    address?: string | null;
    provider?: {
      name: string;
      email?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  const roomType = booking.roomType as { name?: string } | null;
  const traveler = booking.traveler as {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  const guestName =
    (booking.guestName as string | null) || traveler?.name || "Guest";
  const guestEmail =
    (booking.guestEmail as string | null) || traveler?.email || null;
  const guestPhone =
    (booking.guestPhone as string | null) || traveler?.phone || null;

  const method = booking.paymentMethod as string | null;
  const paymentStatus = booking.paymentStatus as string | null;
  const bookingStatus = booking.status as string;
  const isCashOnArrival = method === "CASH_ON_ARRIVAL";
  const isPaid = paymentStatus === "PAID";
  const isReservation =
    isCashOnArrival &&
    !isPaid &&
    (bookingStatus === "RESERVED" ||
      paymentStatus === "NOT_REQUIRED" ||
      paymentStatus === "PENDING");

  const subtotal =
    (booking.subtotalAmount as number) ??
    Math.max(
      0,
      (booking.totalAmount as number) - ((booking.vatAmount as number) || 0),
    );
  const vatAmount = (booking.vatAmount as number) || 0;
  const vatRate = (booking.vatRate as number) || 0;
  const total = booking.totalAmount as number;
  const amountPaid = isPaid
    ? ((booking.amountPaid as number) ?? total)
    : null;
  const receiptNo = isPaid
    ? (booking.receiptNumber as string) || (booking.reference as string)
    : (booking.reference as string);

  const isProviderView =
    !!session?.user &&
    session.user.role !== "TOURIST" &&
    booking.travelerId !== session.user.id;

  const docTitle = isReservation
    ? "Reservation confirmation"
    : isPaid
      ? "Payment receipt"
      : "Booking confirmation";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        {session?.user ? (
          <Link
            href={isProviderView ? "/provider/bookings" : "/account"}
            className="text-sm text-lake-bright underline"
          >
            ← Back
          </Link>
        ) : (
          <Link href="/" className="text-sm text-lake-bright underline">
            ← {brand.name}
          </Link>
        )}
        <ReceiptPrintButton />
      </div>

      {!session?.user && (
        <p className="mb-4 rounded-lg border border-lake/20 bg-lake/5 px-3 py-2 text-sm text-ink-muted print:hidden">
          Guest booking —{" "}
          <Link
            href={`/bookings/${id}${token ? `?t=${encodeURIComponent(token)}` : ""}`}
            className="font-semibold text-lake-bright underline"
          >
            manage or cancel with your link
          </Link>
          {" · "}
          <Link
            href={`/register?email=${encodeURIComponent(guestEmail || "")}`}
            className="font-semibold text-lake-bright underline"
          >
            join free as a member
          </Link>{" "}
          to track stays from My trips.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3 print:hidden">
        <Link
          href={`/bookings/${id}${token ? `?t=${encodeURIComponent(token)}` : ""}`}
          className="text-sm font-medium text-lake-bright underline"
        >
          Confirmation &amp; voucher
        </Link>
        <a
          href={`/api/bookings/${id}/calendar${token ? `?t=${encodeURIComponent(token)}` : ""}`}
          className="text-sm font-medium text-lake-bright underline"
        >
          Add to calendar
        </a>
      </div>

      {isReservation && (
        <p className="mb-4 rounded-lg border border-sun/40 bg-sun/10 px-3 py-2 text-sm text-ink">
          This is a <strong>reservation</strong>, not a paid receipt. Pay{" "}
          {formatKes(total)} on arrival. Your official receipt is issued after
          the host confirms payment.
        </p>
      )}

      <article className="rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="font-display text-2xl font-semibold text-lake">
              {brand.name}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{docTitle}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-ink">
              {isPaid ? `Receipt ${receiptNo}` : `Ref ${booking.reference}`}
            </p>
            {isPaid && booking.reference !== receiptNo && (
              <p className="text-ink-muted">{booking.reference as string}</p>
            )}
            {!isPaid && (
              <p className="text-ink-muted">{bookingStatus}</p>
            )}
          </div>
        </header>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Guest</dt>
            <dd className="mt-0.5 font-medium text-ink">{guestName}</dd>
            {guestEmail && <dd className="text-ink-muted">{guestEmail}</dd>}
            {guestPhone && <dd className="text-ink-muted">{guestPhone}</dd>}
          </div>
          <div>
            <dt className="text-ink-muted">Listing</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {listing?.title || "—"}
            </dd>
            {roomType?.name && (
              <dd className="text-ink-muted">{roomType.name}</dd>
            )}
            {listing?.provider?.name && (
              <dd className="text-ink-muted">{listing.provider.name}</dd>
            )}
          </div>
          <div>
            <dt className="text-ink-muted">Stay</dt>
            <dd className="mt-0.5 text-ink">
              {formatStayDay(booking.checkIn as string)}
              {" → "}
              {formatStayDay(booking.checkOut as string)}
            </dd>
            <dd className="text-ink-muted">
              {(booking.guests as number) || 1} guest
              {(booking.guests as number) === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Payment</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {paymentStatusLabel(paymentStatus, method)}
            </dd>
            <dd className="text-ink-muted">{paymentMethodLabel(method)}</dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-line pt-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">Subtotal</span>
            <span>{formatKes(subtotal)}</span>
          </div>
          {vatAmount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">VAT ({vatRate}%)</span>
              <span>{formatKes(vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 text-base font-semibold">
            <span>{isReservation ? "Amount due" : "Total"}</span>
            <span>{formatKes(total)}</span>
          </div>
          {amountPaid != null && (
            <div className="flex justify-between py-1 text-ink-muted">
              <span>Amount paid</span>
              <span>{formatKes(amountPaid)}</span>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
