"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

type PublicPayments = {
  mpesaEnabled: boolean;
  cardEnabled: boolean;
  cardMode: "sandbox" | "manual";
  cashEnabled: boolean;
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
  const [guestCheckout, setGuestCheckout] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_ARRIVAL");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payments, setPayments] = useState<PublicPayments | null>(null);
  const [mpesaWait, setMpesaWait] = useState<{
    bookingId: string;
    reference: string;
    confirmationUrl?: string;
    accessToken?: string;
  } | null>(null);
  const [card, setCard] = useState<CardFormValues>({
    number: "",
    name: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    void fetch("/api/public/payments")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.cardEnabled === "boolean") {
          setPayments({
            mpesaEnabled: Boolean(d.mpesaEnabled),
            cardEnabled: Boolean(d.cardEnabled),
            cardMode: d.cardMode === "manual" ? "manual" : "sandbox",
            cashEnabled: d.cashEnabled !== false,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!payments) return;
    if (paymentMethod === "CARD" && !payments.cardEnabled) {
      setPaymentMethod(
        payments.cashEnabled
          ? "CASH_ON_ARRIVAL"
          : payments.mpesaEnabled
            ? "MPESA"
            : "CASH_ON_ARRIVAL",
      );
    }
    if (paymentMethod === "MPESA" && payments.mpesaEnabled === false) {
      setPaymentMethod(
        payments.cashEnabled
          ? "CASH_ON_ARRIVAL"
          : payments.cardEnabled
            ? "CARD"
            : "CASH_ON_ARRIVAL",
      );
    }
  }, [payments, paymentMethod]);

  useEffect(() => {
    if (!mpesaWait) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    async function tick() {
      if (cancelled || !mpesaWait) return;
      attempts += 1;
      try {
        const res = await fetch(
          `/api/packages/bookings/${mpesaWait.bookingId}/payment${
            mpesaWait.accessToken
              ? `?t=${encodeURIComponent(mpesaWait.accessToken)}`
              : ""
          }`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.paymentStatus === "PAID") {
          setMpesaWait(null);
          setPaying(false);
          setError(null);
          setSuccess(
            data.message ||
              `Payment received · Package ${data.reference || mpesaWait.reference} confirmed`,
          );
          if (mpesaWait.confirmationUrl) {
            window.location.href = mpesaWait.confirmationUrl;
            return;
          }
          return;
        }
        if (data.paymentStatus === "FAILED") {
          setMpesaWait(null);
          setPaying(false);
          setSuccess(null);
          setError(
            data.message ||
              "M-Pesa payment failed. Package was not confirmed.",
          );
          return;
        }
        setSuccess(
          data.message ||
            `Waiting for M-Pesa on your phone… (${mpesaWait.reference})`,
        );
      } catch {
        // keep waiting
      }
      if (attempts >= maxAttempts) {
        setMpesaWait(null);
        setPaying(false);
        setSuccess(null);
        setError(
          "Still waiting for M-Pesa. If you paid, check your confirmation email shortly. If you cancelled or it failed, try booking again.",
        );
        return;
      }
      window.setTimeout(() => void tick(), 3000);
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [mpesaWait]);

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = new FormData(e.currentTarget);
    if (!session?.user && !guestCheckout) {
      setError("Choose Join as a member, or Continue without joining");
      return;
    }
    const guestName = String(form.get("guestName") || "").trim();
    const guestEmail = String(form.get("guestEmail") || "").trim();
    const guestPhone = String(form.get("guestPhone") || "").trim();
    if (!guestName || !guestEmail) {
      setError("Enter your name and email");
      return;
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
          phone: form.get("phone") || guestPhone || undefined,
          notes: form.get("notes") || undefined,
          guestName,
          guestEmail,
          guestPhone: guestPhone || undefined,
          card: paymentMethod === "CARD" ? card : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        setPaying(false);
        return;
      }
      if (
        (data.pendingMpesa || data.payment?.pendingMpesa) &&
        data.booking?.id
      ) {
        setSuccess(
          data.payment?.message ||
            "M-Pesa prompt sent — enter your PIN on your phone.",
        );
        setMpesaWait({
          bookingId: data.booking.id,
          reference: data.booking.reference,
          confirmationUrl: data.confirmationUrl,
          accessToken: data.accessToken,
        });
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

  const showCard = payments ? payments.cardEnabled : true;
  const showMpesa = payments ? payments.mpesaEnabled : true;
  const showCash = payments ? payments.cashEnabled : true;
  const cardMode = payments?.cardMode || "sandbox";

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
          <p className="text-xs text-ink-muted">
            Optional — join as a member, or book once as a guest below.
          </p>
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
          <div className="space-y-3 rounded-md border border-line/80 bg-sand/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Guest details
            </p>
            <label className="block text-sm">
              Full name
              <input
                name="guestName"
                required
                minLength={2}
                autoComplete="name"
                defaultValue={session?.user?.name || ""}
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Email
              <input
                name="guestEmail"
                type="email"
                required
                autoComplete="email"
                defaultValue={session?.user?.email || ""}
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Phone
              <input
                name="guestPhone"
                type="tel"
                autoComplete="tel"
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          </div>

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
              {showCash && (
                <option value="CASH_ON_ARRIVAL">Cash / pay with host</option>
              )}
              {showMpesa && <option value="MPESA">M-Pesa</option>}
              {showCard && <option value="CARD">Card</option>}
            </select>
          </label>
          {paymentMethod === "MPESA" && (
            <label className="block text-sm">
              M-Pesa phone
              <input
                name="phone"
                required
                placeholder="07…"
                disabled={!!mpesaWait}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 disabled:opacity-60"
              />
            </label>
          )}
          {paymentMethod === "CARD" && showCard && (
            <div className="space-y-2">
              <p className="rounded-md border border-line/80 bg-sand/30 px-3 py-2 text-xs text-ink-muted">
                {cardMode === "manual"
                  ? "Card held for manual confirmation"
                  : "Test card (sandbox — no real charge)"}
              </p>
              <CardPaymentForm values={card} onChange={setCard} />
            </div>
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

          {mpesaWait && (
            <div className="rounded-md border border-lake/30 bg-lake/5 px-3 py-2 text-xs text-ink-muted">
              Enter your M-Pesa PIN on your phone. Package{" "}
              <strong className="text-ink">{mpesaWait.reference}</strong>{" "}
              confirms only after payment succeeds.
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm text-lake-bright">{success}</p>}
          <button
            type="submit"
            disabled={paying || !!mpesaWait}
            className="w-full rounded-md bg-lake py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {mpesaWait
              ? "Waiting for M-Pesa…"
              : paying
                ? paymentMethod === "MPESA"
                  ? "Sending prompt…"
                  : "Booking…"
                : "Confirm package"}
          </button>
        </>
      )}
    </form>
  );
}
