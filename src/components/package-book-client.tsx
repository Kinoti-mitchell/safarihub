"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CardPaymentForm,
  type CardFormValues,
} from "@/components/card-payment-form";
import { BookingTrustStrip } from "@/components/booking-trust-strip";
import { validateCardInput } from "@/lib/card";

type PackageData = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  days: number;
  items: Array<{ id: string; label: string; details: string | null }> | null;
};

export function PackageBookClient({
  pkg,
  trust,
  priceLabel,
}: {
  pkg: PackageData & { slug?: string };
  trust: {
    supportEmail: string;
    supportPhone?: string;
    cancellationHours?: number;
  };
  priceLabel: string;
}) {
  const { data: session } = useSession();
  const pathKey = pkg.slug || pkg.id;
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_ARRIVAL");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CardFormValues>({
    number: "",
    name: "",
    expiry: "",
    cvc: "",
  });

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (!session?.user) {
      if (!guestCheckout) {
        setError("Choose Join as a member, or Continue without joining");
        return;
      }
      if (!String(form.get("guestName") || "").trim() || !String(form.get("guestEmail") || "").trim()) {
        setError("Enter your name and email");
        return;
      }
    }
    if (paymentMethod === "CARD") {
      const cardError = validateCardInput(card);
      if (cardError) {
        setError(cardError);
        return;
      }
    }
    if (paymentMethod === "MPESA" && !String(form.get("phone") || "").trim()) {
      setError("Enter your M-Pesa phone number");
      return;
    }

    setPaying(true);
    try {
      const res = await fetch(`/api/packages/${pkg.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: form.get("startDate"),
          guests: Number(form.get("guests") || 2),
          paymentMethod,
          phone: form.get("phone") || undefined,
          notes: form.get("notes") || undefined,
          guestName: session?.user
            ? undefined
            : String(form.get("guestName") || "").trim(),
          guestEmail: session?.user
            ? undefined
            : String(form.get("guestEmail") || "").trim(),
          guestPhone: session?.user
            ? undefined
            : String(form.get("guestPhone") || "").trim() || undefined,
          card: paymentMethod === "CARD" ? card : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        return;
      }
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }
      setError("Booked, but confirmation link missing");
    } catch {
      setError("Network error — try again");
    } finally {
      setPaying(false);
    }
  }

  return (
    <form
      id="book"
      onSubmit={(e) => void onSubmit(e)}
      className="space-y-4 border border-line bg-white/90 p-5"
    >
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Book this package
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {pkg.days} day{pkg.days === 1 ? "" : "s"} · {priceLabel}
        </p>
      </div>

      {!session?.user ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={`/register?callbackUrl=${encodeURIComponent(`/packages/${pathKey}#book`)}`}
              className="inline-flex items-center justify-center rounded-md bg-lake px-3 py-2.5 text-sm font-semibold text-sand"
            >
              Join as a member
            </Link>
            <button
              type="button"
              onClick={() => setGuestCheckout(true)}
              className={`rounded-md border px-3 py-2.5 text-sm font-medium ${
                guestCheckout
                  ? "border-lake bg-lake/10 text-lake"
                  : "border-line text-ink"
              }`}
            >
              Continue without joining
            </button>
          </div>
        </div>
      ) : null}

      {(session?.user || guestCheckout) && (
        <>
          {!session?.user && (
            <div className="space-y-3 rounded-md border border-line/80 bg-sand/20 p-3">
              <label className="block text-sm">
                Full name
                <input
                  name="guestName"
                  required
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  name="guestEmail"
                  type="email"
                  required
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  name="guestPhone"
                  type="tel"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
            </div>
          )}

          <label className="block text-sm">
            Start date
            <input
              name="startDate"
              type="date"
              required
              min={todayISO()}
              defaultValue={todayISO()}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Guests
            <input
              name="guests"
              type="number"
              min={1}
              defaultValue={2}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Payment
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              <option value="CASH_ON_ARRIVAL">Cash / pay with host</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CARD">Card</option>
            </select>
          </label>
          {paymentMethod === "MPESA" && (
            <label className="block text-sm">
              M-Pesa phone
              <input
                name="phone"
                required
                placeholder="07…"
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          )}
          {paymentMethod === "CARD" && (
            <CardPaymentForm values={card} onChange={setCard} />
          )}
          <label className="block text-sm">
            Notes (optional)
            <textarea
              name="notes"
              rows={2}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>

          <BookingTrustStrip
            supportEmail={trust.supportEmail}
            supportPhone={trust.supportPhone}
            cancellationHours={trust.cancellationHours}
          />

          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={paying}
            className="w-full rounded-md bg-lake py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {paying ? "Booking…" : "Confirm package"}
          </button>
        </>
      )}
    </form>
  );
}
