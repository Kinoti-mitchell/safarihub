"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ProviderBookingsCalendar } from "@/components/provider-bookings-calendar";

export type ProviderBookingRow = {
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
  guests?: number;
  roomsBooked?: number;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  travelerId?: string | null;
  listing?: { title?: string } | null;
  roomType?: { name?: string } | null;
  traveler?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
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

function guestLabel(b: ProviderBookingRow): string {
  return (
    b.guestName ||
    b.traveler?.name ||
    b.guestEmail ||
    b.traveler?.email ||
    "Guest"
  );
}

export function ProviderBookingsClient({
  initialBookings,
}: {
  initialBookings: ProviderBookingRow[];
}) {
  const router = useRouter();
  const [bookings, setBookings] =
    useState<ProviderBookingRow[]>(initialBookings);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cashFor, setCashFor] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");

  function handleAuthFailure() {
    router.replace(
      `/login?next=${encodeURIComponent("/provider/bookings")}`,
    );
  }

  async function reload() {
    const res = await fetch("/api/bookings", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleAuthFailure();
      return;
    }
    if (!res.ok) {
      setError(data.error || "Could not refresh bookings");
      return;
    }
    setBookings(data.bookings || []);
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    setError(null);
    setBusyId(id);
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
      void reload();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusyId(null);
    }
  }

  function openCashForm(b: ProviderBookingRow) {
    setCashFor(b.id);
    setCashAmount(String(b.totalAmount));
    setCashNote("");
    setError(null);
    setMsg(null);
  }

  async function confirmCard(booking: ProviderBookingRow) {
    setBusyId(booking.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) {
        setError(data.error || "Could not confirm card payment");
        return;
      }
      setMsg(
        `Card confirmed for ${booking.reference}. Receipt ${data.booking?.receiptNumber || ""} ready.`,
      );
      void reload();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusyId(null);
    }
  }

  async function submitCash(e: FormEvent, booking: ProviderBookingRow) {
    e.preventDefault();
    const amountPaid = Math.round(Number(cashAmount));
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      setError("Enter the amount the guest paid in KES");
      return;
    }
    setBusyId(booking.id);
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
        `Cash recorded for ${booking.reference}. Receipt ${data.booking?.receiptNumber || ""} ready.`,
      );
      setCashFor(null);
      void reload();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Bookings
          </h1>
          <p className="mt-2 text-ink-muted">
            Open a booking for guest details and payment. Use the calendar for
            check-ins and tour departure days.
          </p>
        </div>
        <div className="flex rounded-lg border border-line bg-white/70 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1.5 font-medium ${
              view === "list" ? "bg-lake text-sand" : "text-ink-muted"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`rounded-md px-3 py-1.5 font-medium ${
              view === "calendar" ? "bg-lake text-sand" : "text-ink-muted"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}
      {error && <p className="mt-4 text-red-700">{error}</p>}
      {view === "calendar" && (
        <ProviderBookingsCalendar bookings={bookings} />
      )}
      <div className={`mt-8 space-y-3 ${view === "calendar" ? "hidden" : ""}`}>
        {bookings.map((b) => {
          const due = b.totalAmount;
          const vat = b.vatAmount ?? 0;
          const needsCash =
            b.paymentMethod === "CASH_ON_ARRIVAL" &&
            b.paymentStatus !== "PAID" &&
            !["CANCELLED", "NO_SHOW"].includes(b.status);
          const needsCardConfirm =
            b.paymentMethod === "CARD" &&
            b.paymentStatus === "PENDING" &&
            !["CANCELLED", "NO_SHOW"].includes(b.status);
          const hasReceipt = b.paymentStatus === "PAID";
          const phone = b.guestPhone || b.traveler?.phone;
          const rooms = b.roomsBooked ?? 1;
          const guests = b.guests ?? 1;

          return (
            <div key={b.id} className="border border-line bg-white/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/provider/bookings/${b.id}`}
                  className="min-w-0 flex-1 rounded-md outline-none ring-lake/40 transition hover:bg-sand/40 focus-visible:ring-2"
                >
                  <p className="font-display text-lg font-semibold text-ink">
                    {b.reference} · {b.listing?.title}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {guestLabel(b)}
                    {phone ? ` · ${phone}` : ""} ·{" "}
                    {b.stayType === "DAYUSE" ? (
                      <>
                        Daytime {formatStayDay(b.checkIn)}
                        {b.dayStartTime
                          ? ` ${b.dayStartTime}–${b.dayEndTime}`
                          : ""}
                      </>
                    ) : (
                      <>
                        {formatStayDay(b.checkIn)} → {formatStayDay(b.checkOut)}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {b.roomType?.name ? `${b.roomType.name} · ` : ""}
                    {rooms} room{rooms === 1 ? "" : "s"} · {guests} guest
                    {guests === 1 ? "" : "s"}
                    {!b.travelerId ? " · Guest checkout" : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    {b.paymentMethod.replace(/_/g, " ")} · {b.paymentStatus} ·{" "}
                    {b.status}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Subtotal KES {(b.subtotalAmount ?? due - vat).toLocaleString()}{" "}
                    + VAT {b.vatRate ?? 16}% (KES {vat.toLocaleString()}) ={" "}
                    <span className="font-semibold text-ink">
                      KES {due.toLocaleString()}
                    </span>
                    {b.amountPaid != null
                      ? ` · received KES ${b.amountPaid.toLocaleString()}`
                      : ""}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-lake">
                    View booking details →
                  </p>
                </Link>
                <div className="flex flex-wrap gap-2">
                  {needsCash && (
                    <button
                      type="button"
                      onClick={() => openCashForm(b)}
                      className="rounded-md bg-sun px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      Record cash paid
                    </button>
                  )}
                  {needsCardConfirm && (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void confirmCard(b)}
                      className="rounded-md bg-sun px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      Confirm card paid
                    </button>
                  )}
                  {hasReceipt && (
                    <Link
                      href={`/receipts/${b.id}`}
                      className="rounded-md border border-lake px-3 py-1.5 text-xs font-semibold text-lake"
                    >
                      Receipt
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => void updateStatus(b.id, "CONFIRMED")}
                    className="rounded-md bg-lake px-3 py-1.5 text-xs text-sand disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => void updateStatus(b.id, "COMPLETED")}
                    className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => void updateStatus(b.id, "CANCELLED")}
                    className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {cashFor === b.id && (
                <form
                  onSubmit={(e) => void submitCash(e, b)}
                  className="mt-4 space-y-3 rounded-lg border border-sun/40 bg-sun/10 p-4"
                >
                  <p className="text-sm font-medium text-ink">
                    Confirm cash on arrival · due{" "}
                    <span className="font-semibold">
                      KES {due.toLocaleString()}
                    </span>{" "}
                    (incl. VAT)
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
                      disabled={busyId === b.id}
                      className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                    >
                      {busyId === b.id
                        ? "Saving…"
                        : "Confirm payment & issue receipt"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashFor(null)}
                      className="rounded-md border border-line px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
        {bookings.length === 0 && !error && (
          <p className="text-ink-muted">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}
