"use client";

import { useCallback, useEffect, useState } from "react";

type AdminBooking = {
  id: string;
  reference: string;
  listingTitle: string;
  providerName: string;
  travelerName: string | null;
  travelerEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
};

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-sun/20 text-ink",
  CONFIRMED: "bg-lake/10 text-lake",
  COMPLETED: "bg-lake text-sand",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load bookings");
        return;
      }
      setError(null);
      setBookings(body.bookings || []);
      setTotal(body.total || 0);
      setRevenue(body.revenue || 0);
    } catch {
      setError("Network error — could not load bookings");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">Bookings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {total} booking{total === 1 ? "" : "s"} · KES{" "}
        {revenue.toLocaleString()} collected
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            status === ""
              ? "border-lake bg-lake text-sand"
              : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
              status === s
                ? "border-lake bg-lake text-sand"
                : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by reference, listing, provider or guest…"
        className="mt-4 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm"
      />

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          No bookings match your filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white/70">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{b.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.listingTitle}</p>
                    <p className="text-xs text-ink-muted">{b.providerName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.travelerName || "—"}</p>
                    <p className="text-xs text-ink-muted">{b.travelerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(b.checkIn).toLocaleDateString()} →{" "}
                    {new Date(b.checkOut).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    KES {b.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <span className="capitalize">
                      {b.paymentMethod.toLowerCase().replace(/_/g, " ")}
                    </span>
                    <span className="block text-xs capitalize">
                      {b.paymentStatus.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        STATUS_STYLE[b.status] || "bg-sand text-ink"
                      }`}
                    >
                      {b.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
