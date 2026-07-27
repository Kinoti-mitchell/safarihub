import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { brandFromSettings } from "@/lib/branding";
import { formatKes } from "@/lib/vat";
import { formatPriceTourist } from "@/lib/currency";
import { ManageBookingActions } from "@/components/manage-booking-actions";
import { PrintVoucherButton } from "@/components/print-voucher-button";
import { getPlatformSettings, numberSetting } from "@/lib/settings";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; confirmed?: string }>;
};

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

export default async function ManageBookingPage({
  params,
  searchParams,
}: Params) {
  const { id } = await params;
  const { t: token, confirmed } = await searchParams;
  const session = await auth();

  const { data: booking } = await db
    .from("Booking")
    .select(
      "*, listing:Listing(id, title, address, slug, phone, latitude, longitude, provider:Provider(name, email, phone)), roomType:RoomType(name), traveler:User(name, email, phone)",
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
    const listingRow = booking.listing as { provider?: { name?: string } } | null;
    void listingRow;
    const { data: listingMeta } = await db
      .from("Listing")
      .select("providerId")
      .eq("id", booking.listingId as string)
      .maybeSingle();
    allowed =
      booking.travelerId === session.user.id ||
      session.user.role === "ADMIN" ||
      (!!access && listingMeta?.providerId === access.provider.id);
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-muted">
          Open the link from your confirmation email, or sign in to manage this
          booking.
        </p>
        <Link
          href={`/login?callbackUrl=/bookings/${id}`}
          className="mt-4 inline-block text-lake-bright underline"
        >
          Log in
        </Link>
      </div>
    );
  }

  const [brand, settings] = await Promise.all([
    brandFromSettings(),
    getPlatformSettings(),
  ]);
  const listing = booking.listing as {
    id: string;
    title: string;
    address?: string | null;
    slug?: string | null;
    phone?: string | null;
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

  const status = booking.status as string;
  const method = booking.paymentMethod as string;
  const paymentStatus = booking.paymentStatus as string;
  const checkIn = booking.checkIn as string;
  const canCancel =
    !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status) &&
    new Date(checkIn).getTime() > Date.now();

  const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
  const receiptHref = `/receipts/${id}${tokenQs}`;
  const calendarHref = `/api/bookings/${id}/calendar${tokenQs}`;
  const showConfirmBanner =
    confirmed === "1" ||
    status === "CONFIRMED" ||
    status === "RESERVED" ||
    paymentStatus === "PAID";

  const price = formatPriceTourist(
    booking.totalAmount as number,
    brand.currency,
  );
  const cancelHours = numberSetting(settings, "booking.cancellationWindowHours");

  const voucherData = [
    `Safari Hub`,
    `Ref ${booking.reference}`,
    listing?.title || "",
    `${formatStayDay(checkIn)} → ${formatStayDay(booking.checkOut as string)}`,
    guestName,
  ]
    .filter(Boolean)
    .join(" · ");
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    voucherData,
  )}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 print:hidden">
        <Link href="/" className="text-sm text-lake-bright underline">
          ← {brand.name}
        </Link>
      </div>

      {showConfirmBanner && status !== "CANCELLED" && (
        <div className="mb-6 rounded-xl border border-lake/25 bg-lake/5 px-4 py-4">
          <p className="font-display text-xl font-semibold text-lake">
            You&apos;re booked
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Reference <strong className="text-ink">{booking.reference as string}</strong>
            {" · "}
            {paymentStatus === "PAID"
              ? "Payment received"
              : method === "CASH_ON_ARRIVAL"
                ? "Pay on arrival"
                : paymentStatus}
            . Save this page — it is your voucher and manage link.
          </p>
        </div>
      )}

      <article className="rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Booking voucher
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
              {listing?.title || "Your stay"}
            </h1>
            {roomType?.name && (
              <p className="text-sm text-ink-muted">{roomType.name}</p>
            )}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR for ${booking.reference}`}
            width={96}
            height={96}
            className="rounded-md border border-line bg-white p-1"
          />
        </header>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Guest</dt>
            <dd className="mt-0.5 font-medium text-ink">{guestName}</dd>
            {guestEmail && <dd className="text-ink-muted">{guestEmail}</dd>}
            {guestPhone && <dd className="text-ink-muted">{guestPhone}</dd>}
          </div>
          <div>
            <dt className="text-ink-muted">When</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {formatStayDay(checkIn)} →{" "}
              {formatStayDay(booking.checkOut as string)}
            </dd>
            <dd className="text-ink-muted">
              {(booking.guests as number) || 1} guest
              {(booking.guests as number) === 1 ? "" : "s"} · {status}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Host</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {listing?.provider?.name || "—"}
            </dd>
            {(listing?.provider?.phone || listing?.phone) && (
              <dd className="text-ink-muted">
                {listing?.provider?.phone || listing?.phone}
              </dd>
            )}
            {listing?.address && (
              <dd className="text-ink-muted">{listing.address}</dd>
            )}
          </div>
          <div>
            <dt className="text-ink-muted">Total</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {formatKes(booking.totalAmount as number)}
            </dd>
            {price.approx && (
              <dd className="text-ink-muted">{price.approx}</dd>
            )}
            <dd className="text-ink-muted">
              {method === "CASH_ON_ARRIVAL"
                ? "Cash on arrival"
                : method === "MPESA"
                  ? "M-Pesa"
                  : method === "CARD"
                    ? "Card"
                    : method}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-2 border-t border-line pt-4 text-sm text-ink-muted">
          <p>
            Bring this voucher (or the QR) to check-in. Free cancellation before
            check-in
            {cancelHours > 0 ? ` — aim for ${cancelHours}h+ notice` : ""}.{" "}
            <Link href="/legal/cancellation" className="text-lake-bright underline">
              Policy
            </Link>
          </p>
          <p>
            Support:{" "}
            <a
              href={`mailto:${brand.supportEmail}`}
              className="text-lake-bright underline"
            >
              {brand.supportEmail}
            </a>
            {brand.supportPhone ? ` · ${brand.supportPhone}` : ""}
          </p>
          <p className="text-xs">
            Emergency in Kenya: 999 / 112. Share this page with a travel
            companion if helpful.
          </p>
        </div>
      </article>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <a
          href={calendarHref}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
        >
          Add to calendar
        </a>
        <Link
          href={receiptHref}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-lake-bright"
        >
          VAT receipt
        </Link>
        <PrintVoucherButton />
      </div>

      <section className="mt-10 print:hidden">
        <h2 className="font-display text-lg font-semibold text-ink">
          Manage booking
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Guests can cancel with this link — no account required.
        </p>
        <div className="mt-4">
          <ManageBookingActions
            bookingId={id}
            accessToken={token || (booking.accessToken as string | null)}
            canCancel={canCancel}
            status={status}
          />
        </div>
        {!session?.user && guestEmail && (
          <p className="mt-4 text-xs text-ink-muted">
            Want trips in one place?{" "}
            <Link
              href={`/register?email=${encodeURIComponent(guestEmail)}`}
              className="text-lake-bright underline"
            >
              Create a free member account
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
