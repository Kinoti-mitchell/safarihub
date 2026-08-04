"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ListingBooking = {
  kind: "listing";
  id: string;
  reference: string;
  title: string;
  href: string;
  checkIn: string;
  checkOut: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  subtotalAmount?: number | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  receiptNumber?: string | null;
  stayType?: string;
  dayStartTime?: string | null;
  dayEndTime?: string | null;
  review?: unknown;
  createdAt?: string;
};

type PackageBooking = {
  kind: "package";
  id: string;
  reference: string;
  title: string;
  href: string;
  checkIn: string;
  checkOut: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt?: string;
};

type Trip = ListingBooking | PackageBooking;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-sun/20 text-ink",
  RESERVED: "bg-sun/20 text-ink",
  CONFIRMED: "bg-lake/10 text-lake",
  COMPLETED: "bg-lake text-sand",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

const CANCELLABLE = new Set(["PENDING", "RESERVED", "CONFIRMED"]);

export default function AccountTripsPage() {
  const [listingBookings, setListingBookings] = useState<
    Array<Omit<ListingBooking, "kind" | "title" | "href"> & {
      listing?: { title?: string; id?: string } | null;
    }>
  >([]);
  const [packageBookings, setPackageBookings] = useState<
    Array<{
      id: string;
      reference: string;
      startDate: string;
      status: string;
      paymentMethod: string;
      paymentStatus: string;
      totalAmount: number;
      createdAt?: string;
      package?: { title?: string; days?: number } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const b = await fetch("/api/bookings").then((r) => r.json());
      if (b.error) setError(b.error);
      else {
        setError(null);
        setListingBookings(b.bookings || []);
        setPackageBookings(b.packageBookings || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const trips: Trip[] = useMemo(() => {
    const listing: ListingBooking[] = listingBookings.map((b) => ({
      kind: "listing" as const,
      id: b.id,
      reference: b.reference,
      title: b.listing?.title || "Booking",
      href: `/bookings/${b.id}`,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount,
      subtotalAmount: b.subtotalAmount,
      vatAmount: b.vatAmount,
      vatRate: b.vatRate,
      receiptNumber: b.receiptNumber,
      stayType: b.stayType,
      dayStartTime: b.dayStartTime,
      dayEndTime: b.dayEndTime,
      review: b.review,
      createdAt: b.createdAt,
    }));
    const packages: PackageBooking[] = packageBookings.map((p) => ({
      kind: "package" as const,
      id: p.id,
      reference: p.reference,
      title: p.package?.title || "Travel package",
      href: `/packages/bookings/${p.id}`,
      checkIn: p.startDate,
      checkOut: p.startDate,
      status: p.status,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      totalAmount: p.totalAmount,
      createdAt: p.createdAt,
    }));
    return [...listing, ...packages].sort((a, b) => {
      const aKey = a.createdAt || a.checkIn;
      const bKey = b.createdAt || b.checkIn;
      return new Date(bKey).getTime() - new Date(aKey).getTime();
    });
  }, [listingBookings, packageBookings]);

  async function leaveReview(e: FormEvent<HTMLFormElement>, bookingId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        rating: Number(form.get("rating")),
        comment: form.get("comment"),
      }),
    });
    if (res.ok) void load();
  }

  async function cancelListingBooking(booking: ListingBooking) {
    if (
      !window.confirm(
        `Cancel booking ${booking.reference}? Paid amounts are refunded in the ledger.`,
      )
    ) {
      return;
    }
    setBusyId(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Cancelled by guest",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not cancel");
        return;
      }
      void load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">My trips</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Your stays and packages across Safari Hub. Leave a review once a stay is
        complete.
      </p>

      {error && (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading trips…</p>
      ) : trips.length === 0 && !error ? (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-white/40 px-4 py-12 text-center text-sm text-ink-muted">
          No bookings yet.{" "}
          <Link href="/browse" className="text-lake-bright underline">
            Explore stays
          </Link>{" "}
          or{" "}
          <Link href="/packages" className="text-lake-bright underline">
            packages
          </Link>{" "}
          to plan your first trip.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {trips.map((b) => {
            const beforeCheckIn = new Date(b.checkIn).getTime() > Date.now();
            const canCancel =
              b.kind === "listing" &&
              CANCELLABLE.has(b.status) &&
              beforeCheckIn;
            return (
              <div
                key={`${b.kind}-${b.id}`}
                className="rounded-xl border border-line bg-white/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-semibold">
                      <Link
                        href={b.href}
                        className="hover:text-lake-bright hover:underline"
                      >
                        {b.title}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      <span className="font-mono text-xs">{b.reference}</span>
                      {b.kind === "package" ? " · Package · " : " · "}
                      {b.kind === "listing" && b.stayType === "DAYUSE" ? (
                        <>
                          Daytime {new Date(b.checkIn).toLocaleDateString()}
                          {b.dayStartTime && b.dayEndTime
                            ? ` · ${b.dayStartTime}–${b.dayEndTime}`
                            : ""}
                        </>
                      ) : b.kind === "package" ? (
                        <>Starts {new Date(b.checkIn).toLocaleDateString()}</>
                      ) : (
                        <>
                          Overnight {new Date(b.checkIn).toLocaleDateString()} →{" "}
                          {new Date(b.checkOut).toLocaleDateString()}
                        </>
                      )}{" "}
                      · {b.paymentMethod.toLowerCase().replace(/_/g, " ")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      STATUS_STYLE[b.status] || "bg-sand text-ink"
                    }`}
                  >
                    {b.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-2 font-medium">
                  KES {b.totalAmount.toLocaleString()}
                  {b.kind === "listing" &&
                  b.vatAmount != null &&
                  b.vatAmount > 0
                    ? ` (incl. VAT ${b.vatRate ?? 16}%)`
                    : ""}
                  {b.paymentStatus === "REFUNDED" ? " · refunded" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm font-medium">
                  <Link
                    href={b.href}
                    className="text-lake-bright underline"
                  >
                    {b.kind === "package"
                      ? "View package voucher →"
                      : "Manage / voucher →"}
                  </Link>
                  {b.kind === "listing" &&
                    (b.paymentStatus === "PAID" ||
                      b.paymentStatus === "NOT_REQUIRED" ||
                      b.receiptNumber) && (
                      <Link
                        href={`/receipts/${b.id}`}
                        className="text-ink-muted underline hover:text-lake-bright"
                      >
                        Receipt
                      </Link>
                    )}
                </div>
                {canCancel && b.kind === "listing" && (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => void cancelListingBooking(b)}
                    className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                  >
                    {busyId === b.id ? "Cancelling…" : "Cancel booking"}
                  </button>
                )}
                {b.kind === "listing" &&
                  b.status === "COMPLETED" &&
                  !b.review && (
                    <form
                      onSubmit={(e) => void leaveReview(e, b.id)}
                      className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3"
                    >
                      <select
                        name="rating"
                        className="rounded-md border border-line px-2 py-1 text-sm"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} stars
                          </option>
                        ))}
                      </select>
                      <input
                        name="comment"
                        placeholder="Share how it went…"
                        className="min-w-[200px] flex-1 rounded-md border border-line px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-lake px-3 py-1 text-sm font-semibold text-sand transition hover:bg-lake-bright"
                      >
                        Post review
                      </button>
                    </form>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
