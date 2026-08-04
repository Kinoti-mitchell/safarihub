"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export type BookingDetail = {
  id: string;
  reference: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  subtotalAmount?: number | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  amountPaid?: number | null;
  receiptNumber?: string | null;
  stayType?: string;
  dayStartTime?: string | null;
  dayEndTime?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomsBooked: number;
  notes?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  travelerId?: string | null;
  createdAt?: string;
  paidAt?: string | null;
  listing?: {
    title?: string;
    address?: string | null;
    county?: { name?: string } | null;
  } | null;
  roomType?: {
    name?: string;
    kind?: string | null;
    basePrice?: number | null;
    description?: string | null;
  } | null;
  traveler?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  payments?: Array<{
    id: string;
    method: string;
    status: string;
    amount: number;
    createdAt: string;
  }>;
};

export type PriorBooking = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  roomsBooked?: number | null;
  guests?: number | null;
  listing?: { title?: string } | null;
};

function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function formatStayDay(value: string): string {
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
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stayNights(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn.slice(0, 10) + "T12:00:00");
  const b = Date.parse(checkOut.slice(0, 10) + "T12:00:00");
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

function guestOf(b: BookingDetail) {
  return {
    name: b.guestName || b.traveler?.name || "Guest",
    email: b.guestEmail || b.traveler?.email || null,
    phone: b.guestPhone || b.traveler?.phone || null,
    isMember: Boolean(b.travelerId),
  };
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "CASH_ON_ARRIVAL":
      return "Cash on arrival";
    case "MPESA":
      return "M-Pesa";
    case "CARD":
      return "Card";
    default:
      return method.replace(/_/g, " ");
  }
}

function statusTone(status: string) {
  switch (status) {
    case "PENDING":
    case "RESERVED":
      return "border-sun/50 bg-sun/15 text-ink";
    case "CONFIRMED":
      return "border-lake/30 bg-lake/10 text-lake";
    case "COMPLETED":
      return "border-line bg-sand/60 text-ink-muted";
    case "CANCELLED":
    case "NO_SHOW":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-line bg-white text-ink";
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function ProviderBookingDetailClient({
  initialBooking,
  initialPriorBookings,
  platformName = "Platform",
}: {
  initialBooking: BookingDetail;
  initialPriorBookings: PriorBooking[];
  platformName?: string;
}) {
  const router = useRouter();
  const id = initialBooking.id;
  const [booking, setBooking] = useState<BookingDetail>(initialBooking);
  const [priorBookings, setPriorBookings] =
    useState<PriorBooking[]>(initialPriorBookings);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCash, setShowCash] = useState(false);
  const [cashAmount, setCashAmount] = useState(
    String(initialBooking.totalAmount ?? ""),
  );
  const [cashNote, setCashNote] = useState("");

  function handleAuthFailure() {
    router.replace(
      `/login?next=${encodeURIComponent(`/provider/bookings/${id}`)}`,
    );
  }

  async function load() {
    const res = await fetch(`/api/bookings/${id}`, {
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleAuthFailure();
      return;
    }
    if (!res.ok) {
      setError(data.error || "Could not refresh booking");
      return;
    }
    setBooking(data.booking);
    setPriorBookings(data.priorBookings || []);
    setCashAmount(String(data.booking?.totalAmount ?? ""));
    router.refresh();
  }

  async function updateStatus(status: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) {
        setError(data.error || `Could not set status to ${status}`);
        return;
      }
      setMsg(
        status === "CONFIRMED"
          ? data.emailed
            ? "Booking confirmed — confirmation email sent to the guest."
            : "Booking confirmed. Could not email the guest (missing email or email not configured in Admin → Settings)."
          : status === "CANCELLED"
            ? "Booking declined / cancelled."
            : `Status updated to ${status}.`,
      );
      void load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  async function submitCash(e: FormEvent) {
    e.preventDefault();
    const amountPaid = Math.round(Number(cashAmount));
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      setError("Enter the amount the guest paid in KES");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          amountPaid,
          note: cashNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) {
        setError(data.error || "Could not record cash payment");
        return;
      }
      setMsg(
        `Cash recorded. Receipt ${data.booking?.receiptNumber || ""} ready.`,
      );
      setShowCash(false);
      void load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  const guest = guestOf(booking);
  const due = booking.totalAmount;
  const vat = booking.vatAmount ?? 0;
  const subtotal = booking.subtotalAmount ?? due - vat;
  const rooms = booking.roomsBooked || 1;
  const guests = booking.guests || 1;
  const isDayUse = booking.stayType === "DAYUSE";
  const nights = isDayUse ? 1 : stayNights(booking.checkIn, booking.checkOut);
  const needsCash =
    booking.paymentMethod === "CASH_ON_ARRIVAL" &&
    booking.paymentStatus !== "PAID" &&
    !["CANCELLED", "NO_SHOW"].includes(booking.status);
  const hasReceipt = booking.paymentStatus === "PAID";
  const awaitingDecision = ["PENDING", "RESERVED"].includes(booking.status);
  const canComplete = ["CONFIRMED", "RESERVED"].includes(booking.status);
  const canCancel = !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(
    booking.status,
  );
  const priorCompleted = priorBookings.filter((p) =>
    ["COMPLETED", "CONFIRMED"].includes(p.status),
  ).length;
  const priorCancelled = priorBookings.filter((p) =>
    ["CANCELLED", "NO_SHOW"].includes(p.status),
  ).length;
  const unitHint =
    booking.roomType?.basePrice != null
      ? booking.roomType.basePrice
      : nights > 0 && rooms > 0
        ? Math.round(subtotal / (nights * rooms))
        : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 pb-28">
      <Link href="/provider/bookings" className="text-sm text-lake underline">
        ← Back to bookings
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusTone(booking.status)}`}
          >
            {awaitingDecision
              ? "Awaiting your confirmation"
              : booking.status.replace(/_/g, " ")}
          </span>
          <span className="text-sm text-ink-muted">{booking.reference}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold text-lake">
          {awaitingDecision ? "Review booking request" : "Booking details"}
        </h1>
        <p className="mt-2 text-ink-muted">
          {awaitingDecision
            ? "Check the guest details, stay request, invoice, and any prior stays before you confirm or decline."
            : `Manage this reservation for ${booking.listing?.title || "your listing"}.`}
        </p>
      </header>

      {msg && (
        <p className="mt-4 rounded-md border border-lake/20 bg-lake/5 px-3 py-2 text-sm text-lake">
          {msg}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* 1. Guest */}
      <section className="mt-8 border border-line bg-white/80 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          1. Guest details
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Contact information shared when they booked.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name">{guest.name}</Field>
          <Field label="Account type">
            {guest.isMember ? `${platformName} member` : "Guest checkout (no account)"}
          </Field>
          <Field label="Email">
            {guest.email ? (
              <a href={`mailto:${guest.email}`} className="text-lake underline">
                {guest.email}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Phone">
            {guest.phone ? (
              <a href={`tel:${guest.phone}`} className="text-lake underline">
                {guest.phone}
              </a>
            ) : (
              "—"
            )}
          </Field>
          {booking.createdAt && (
            <Field label="Submitted">
              {new Date(booking.createdAt).toLocaleString("en-KE", {
                timeZone: "Africa/Nairobi",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </Field>
          )}
        </dl>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">
            Notes from guest
          </p>
          {booking.notes?.trim() ? (
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-sun/30 bg-sun/10 px-3 py-3 text-sm text-ink">
              {booking.notes.trim()}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              No special requests or notes were added.
            </p>
          )}
        </div>
      </section>

      {/* 2. Stay */}
      <section className="mt-4 border border-line bg-white/80 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          2. Stay request
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          What they asked to book — confirm you can honour these dates and rooms.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Listing">{booking.listing?.title || "—"}</Field>
          <Field label="Stay type">{isDayUse ? "Day use" : "Overnight"}</Field>
          <Field label={isDayUse ? "Date" : "Check-in"}>
            {formatStayDay(booking.checkIn)}
          </Field>
          {!isDayUse ? (
            <Field label="Check-out">{formatStayDay(booking.checkOut)}</Field>
          ) : (
            <Field label="Hours">
              {booking.dayStartTime || "—"}–{booking.dayEndTime || "—"}
            </Field>
          )}
          {!isDayUse && <Field label="Nights">{nights}</Field>}
          <Field label="Room / offer">
            {booking.roomType?.name || "—"}
            {booking.roomType?.description ? (
              <span className="mt-1 block font-normal text-ink-muted">
                {booking.roomType.description}
              </span>
            ) : null}
          </Field>
          <Field label="Rooms">
            {rooms} room{rooms === 1 ? "" : "s"}
          </Field>
          <Field label="Guests">
            {guests} guest{guests === 1 ? "" : "s"}
          </Field>
          {(booking.listing?.address || booking.listing?.county?.name) && (
            <div className="sm:col-span-2">
              <Field label="Property location">
                {[booking.listing?.address, booking.listing?.county?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </Field>
            </div>
          )}
        </dl>
      </section>

      {/* 3. Invoice */}
      <section className="mt-4 border border-line bg-white/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              3. Invoice
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Amounts the guest will pay (VAT inclusive total).
            </p>
          </div>
          {hasReceipt && (
            <Link
              href={`/receipts/${booking.id}`}
              className="text-sm font-semibold text-lake underline"
            >
              Open receipt / confirmation →
            </Link>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-sand/40 text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="px-3 py-3">
                  <p className="font-medium text-ink">
                    {booking.roomType?.name || "Stay"}
                  </p>
                  <p className="text-ink-muted">
                    {isDayUse
                      ? `Day use · ${rooms} room${rooms === 1 ? "" : "s"} · ${guests} guest${guests === 1 ? "" : "s"}`
                      : `${nights} night${nights === 1 ? "" : "s"} · ${rooms} room${rooms === 1 ? "" : "s"} · ${guests} guest${guests === 1 ? "" : "s"}`}
                    {unitHint != null
                      ? ` · ~${formatKes(unitHint)} / room / ${isDayUse ? "day" : "night"}`
                      : ""}
                  </p>
                </td>
                <td className="px-3 py-3 text-right font-medium align-top">
                  {formatKes(subtotal)}
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-3 py-2 text-ink-muted">
                  VAT ({booking.vatRate ?? 16}%)
                </td>
                <td className="px-3 py-2 text-right">{formatKes(vat)}</td>
              </tr>
              <tr className="bg-sand/30">
                <td className="px-3 py-3 font-semibold text-ink">Total due</td>
                <td className="px-3 py-3 text-right font-display text-lg font-semibold text-lake">
                  {formatKes(due)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Payment method">
            {paymentMethodLabel(booking.paymentMethod)}
          </Field>
          <Field label="Payment status">
            {booking.paymentStatus.replace(/_/g, " ")}
            {booking.amountPaid != null
              ? ` · received ${formatKes(booking.amountPaid)}`
              : ""}
          </Field>
          {booking.receiptNumber && (
            <Field label="Receipt #">{booking.receiptNumber}</Field>
          )}
          {booking.payments && booking.payments.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-ink-muted">
                Payment attempts
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {booking.payments.map((p) => (
                  <li key={p.id} className="text-ink-muted">
                    {paymentMethodLabel(p.method)} · {p.status} ·{" "}
                    {formatKes(p.amount)} ·{" "}
                    {new Date(p.createdAt).toLocaleString("en-KE", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </dl>

        {booking.paymentMethod === "CASH_ON_ARRIVAL" &&
          booking.paymentStatus !== "PAID" && (
            <p className="mt-4 rounded-md border border-sun/40 bg-sun/10 px-3 py-2 text-sm text-ink">
              Guest chose <strong>cash on arrival</strong>. Confirm the stay
              first; record cash when they pay at the property to issue the
              official receipt.
            </p>
          )}
      </section>

      {/* 4. Prior history */}
      <section className="mt-4 border border-line bg-white/80 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          4. Prior stays with you
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Earlier bookings from this guest across your listings — useful before
          you approve.
        </p>

        {priorBookings.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No earlier bookings found for this guest at your properties. This
            looks like a first-time stay with you.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-ink">
              <span className="font-semibold">{priorBookings.length}</span> prior
              booking{priorBookings.length === 1 ? "" : "s"}
              {priorCompleted > 0
                ? ` · ${priorCompleted} confirmed/completed`
                : ""}
              {priorCancelled > 0
                ? ` · ${priorCancelled} cancelled/no-show`
                : ""}
            </p>
            <ul className="mt-4 divide-y divide-line border border-line">
              {priorBookings.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/provider/bookings/${p.id}`}
                    className="flex flex-wrap items-start justify-between gap-2 px-3 py-3 text-sm transition hover:bg-sand/40"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {p.reference} · {p.listing?.title || "Listing"}
                      </p>
                      <p className="text-ink-muted">
                        {formatStayDay(p.checkIn)} → {formatStayDay(p.checkOut)}
                        {p.roomsBooked
                          ? ` · ${p.roomsBooked} room${p.roomsBooked === 1 ? "" : "s"}`
                          : ""}
                        {p.guests
                          ? ` · ${p.guests} guest${p.guests === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${statusTone(p.status)}`}
                      >
                        {p.status.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-ink-muted">
                        {formatKes(p.totalAmount)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 5. Decision */}
      <section className="mt-4 border border-lake/25 bg-lake/[0.04] p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          5. Your decision
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {awaitingDecision
            ? "Only confirm after you have reviewed the guest, dates, rooms, invoice, and history above. The guest will receive a confirmation email."
            : "Update the booking status or record payment as needed. Confirming emails the guest."}
        </p>

        {showCash && (
          <form
            onSubmit={(e) => void submitCash(e)}
            className="mt-4 space-y-3 rounded-lg border border-sun/40 bg-sun/10 p-4"
          >
            <p className="text-sm font-medium text-ink">
              Confirm cash on arrival · due{" "}
              <span className="font-semibold">{formatKes(due)}</span> (incl. VAT)
            </p>
            <label className="block text-sm">
              Amount paid by guest (KES)
              <input
                type="number"
                min={due}
                step={1}
                required
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Note (optional)
              <input
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                placeholder="e.g. paid in notes, change given…"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
              >
                {busy ? "Saving…" : "Confirm payment & issue receipt"}
              </button>
              <button
                type="button"
                onClick={() => setShowCash(false)}
                className="rounded-md border border-line px-4 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {awaitingDecision && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void updateStatus("CONFIRMED")}
              className="rounded-md bg-lake px-5 py-3 text-sm font-semibold text-sand disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm booking"}
            </button>
          )}
          {needsCash && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCash(true)}
              className="rounded-md bg-sun px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Record cash paid
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void updateStatus("COMPLETED")}
              className="rounded-md border border-line bg-white px-5 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Mark completed
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    awaitingDecision
                      ? "Decline this booking request? The guest will be notified."
                      : "Cancel this booking? The guest will be notified.",
                  )
                ) {
                  void updateStatus("CANCELLED");
                }
              }}
              className="rounded-md border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-800 disabled:opacity-50"
            >
              {awaitingDecision ? "Decline request" : "Cancel booking"}
            </button>
          )}
          {hasReceipt && (
            <Link
              href={`/receipts/${booking.id}`}
              className="inline-flex items-center justify-center rounded-md border border-lake px-5 py-3 text-sm font-semibold text-lake"
            >
              View receipt
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
