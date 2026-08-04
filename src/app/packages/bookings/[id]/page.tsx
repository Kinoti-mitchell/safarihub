import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { brandFromSettings } from "@/lib/branding";
import { formatKes } from "@/lib/vat";
import { PrintVoucherButton } from "@/components/print-voucher-button";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; confirmed?: string }>;
};

function formatDay(value: string): string {
  const day = value.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PackageBookingPage({
  params,
  searchParams,
}: Params) {
  const { id } = await params;
  const { t: token } = await searchParams;
  const session = await auth();

  const { data: booking } = await db
    .from("PackageBooking")
    .select(
      "*, package:TravelPackage(title, days, price), traveler:User(name, email, phone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const tokenOk =
    Boolean(token) &&
    Boolean(booking.accessToken) &&
    token === (booking.accessToken as string);
  const allowed =
    tokenOk ||
    (!!session?.user &&
      (booking.travelerId === session.user.id ||
        session.user.role === "ADMIN"));

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-muted">
          Open the confirmation link from your email to view this package
          booking.
        </p>
      </div>
    );
  }

  const brand = await brandFromSettings();
  const pkg = booking.package as {
    title?: string;
    days?: number;
  } | null;
  const voucherData = `${brand.name} package · ${booking.reference} · ${pkg?.title || ""}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(voucherData)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/packages" className="text-sm text-lake-bright underline print:hidden">
        ← Packages
      </Link>

      <div className="mt-6 mb-4 rounded-xl border border-lake/25 bg-lake/5 px-4 py-4">
        <p className="font-display text-xl font-semibold text-lake">
          Package reserved
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Reference <strong className="text-ink">{booking.reference as string}</strong>
          {" · "}
          {booking.paymentStatus as string}
        </p>
      </div>

      <article className="rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Package voucher
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
              {pkg?.title || "Travel package"}
            </h1>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR for ${booking.reference}`}
            width={96}
            height={96}
            className="rounded-md border border-line p-1"
          />
        </header>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Guest</dt>
            <dd className="mt-0.5 font-medium">
              {(booking.guestName as string | null) ||
                (booking.traveler as { name?: string | null } | null)?.name ||
                "Guest"}
            </dd>
            <dd className="text-ink-muted">
              {(booking.guestEmail as string | null) ||
                (booking.traveler as { email?: string | null } | null)?.email ||
                null}
            </dd>
            {((booking.guestPhone as string | null) ||
              (booking.traveler as { phone?: string | null } | null)?.phone) && (
              <dd className="text-ink-muted">
                {(booking.guestPhone as string | null) ||
                  (booking.traveler as { phone?: string | null } | null)?.phone}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-ink-muted">Starts</dt>
            <dd className="mt-0.5 font-medium">
              {formatDay(booking.startDate as string)}
            </dd>
            <dd className="text-ink-muted">
              {(booking.guests as number) || 1} guests · {pkg?.days || "?"} days
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Total</dt>
            <dd className="mt-0.5 font-medium">
              {formatKes(booking.totalAmount as number)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Status</dt>
            <dd className="mt-0.5 font-medium">{booking.status as string}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-ink-muted">
          Support:{" "}
          <a
            href={`mailto:${brand.supportEmail}`}
            className="text-lake-bright underline"
          >
            {brand.supportEmail}
          </a>
          {brand.supportPhone ? ` · ${brand.supportPhone}` : ""}
        </p>
      </article>

      <div className="mt-6 print:hidden">
        <PrintVoucherButton />
      </div>
    </div>
  );
}
