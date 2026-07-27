"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { publicProviderPath } from "@/lib/listing-paths";
import {
  CardPaymentForm,
  type CardFormValues,
} from "@/components/card-payment-form";
import { ListingPlaceInfo } from "@/components/listing-place-info";
import { ListingAmenitiesPanel } from "@/components/listing-amenities-panel";
import { validateCardInput } from "@/lib/card";
import { offerKindLabel, CATEGORY_LABELS } from "@/lib/amenities";
import {
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
} from "@/lib/geo";
import { BookingTrustStrip } from "@/components/booking-trust-strip";
import { formatPriceTourist } from "@/lib/currency";

function listingTypeLine(listing: {
  category?: string;
  categories?: string[];
  venueTypes?: string[];
  listingKinds?: string[];
}): string {
  const kinds = Array.isArray(listing.listingKinds)
    ? listing.listingKinds.map((k) =>
        k === "PLACE"
          ? "Place"
          : k === "EXPERIENCE"
            ? "Experience / tour"
            : k === "EVENT"
              ? "Event"
              : k === "PACKAGE"
                ? "Travel package"
                : k,
      )
    : [];
  const types = Array.isArray(listing.venueTypes) ? listing.venueTypes : [];
  const cats =
    Array.isArray(listing.categories) && listing.categories.length
      ? listing.categories
      : listing.category
        ? [listing.category]
        : [];
  const catBits = cats.map(
    (c) => CATEGORY_LABELS[c]?.split(" (")[0] || c,
  );
  return [...kinds, ...types, ...catBits].filter(Boolean).join(" · ");
}

export function ListingDetailClient({
  params,
  trust,
}: {
  params: Promise<{ id: string }>;
  trust?: {
    supportEmail?: string;
    supportPhone?: string;
    cancellationHours?: number;
    displayCurrency?: string;
  };
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [listing, setListing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [askMsg, setAskMsg] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysISO(iso: string, days: number) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  const minCheckIn = todayISO();
  const [checkIn, setCheckIn] = useState(minCheckIn);
  const [checkOut, setCheckOut] = useState(() => addDaysISO(minCheckIn, 1));
  const minCheckOut = addDaysISO(checkIn, 1);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [stayType, setStayType] = useState<"OVERNIGHT" | "DAYUSE">("OVERNIGHT");
  const [dayStartTime, setDayStartTime] = useState("10:00");
  const [dayEndTime, setDayEndTime] = useState("18:00");
  const [paying, setPaying] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [guestHint, setGuestHint] = useState(false);
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [mpesaWait, setMpesaWait] = useState<{
    bookingId: string;
    reference: string;
    receiptUrl?: string;
    confirmationUrl?: string;
    accessToken?: string;
  } | null>(null);
  const [card, setCard] = useState<CardFormValues>({
    number: "",
    name: "",
    expiry: "",
    cvc: "",
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  useEffect(() => {
    void fetch(`/api/listings/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setListing(d.listing);
          const l = d.listing;
          if (l?.acceptMpesa) setPaymentMethod("MPESA");
          else if (l?.acceptCard) setPaymentMethod("CARD");
          else if (l?.acceptCashOnArrival) setPaymentMethod("CASH_ON_ARRIVAL");
          if (l?.roomTypes?.[0]?.id) setSelectedRoomId(l.roomTypes[0].id);
          const overnight = l?.allowOvernight !== false;
          const dayUse = l?.allowDayUse !== false;
          if (!overnight && dayUse) setStayType("DAYUSE");
          else setStayType("OVERNIGHT");
        }
      });
  }, [id]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/favorites")
      .then((r) => r.json())
      .then((d) => {
        const ids = (d.favorites || []).map(
          (f: { listingId: string }) => f.listingId,
        );
        setSaved(ids.includes(id));
      })
      .catch(() => undefined);
  }, [session?.user, id]);

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
          `/api/bookings/${mpesaWait.bookingId}/payment${
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
              `Payment received · Booking ${data.reference || mpesaWait.reference} confirmed`,
          );
          if (mpesaWait.receiptUrl) setReceiptUrl(mpesaWait.receiptUrl);
          if (mpesaWait.confirmationUrl) {
            setConfirmationUrl(mpesaWait.confirmationUrl);
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
              "M-Pesa payment failed. Booking was not confirmed.",
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
          "Still waiting for M-Pesa. If you paid, check My trips shortly. If you cancelled or it failed, try booking again.",
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

  async function toggleSave() {
    if (!session?.user) {
      window.location.href = `/login?callbackUrl=/listings/${id}`;
      return;
    }
    setSaving(true);
    try {
      if (saved) {
        await fetch(`/api/favorites?listingId=${id}`, { method: "DELETE" });
        setSaved(false);
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: id }),
        });
        if (res.ok) setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function book(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = new FormData(e.currentTarget);
    const checkInVal = String(form.get("checkIn") || "");
    const checkOutVal = String(form.get("checkOut") || "");
    if (checkInVal < minCheckIn) {
      setError("Check-in cannot be before today");
      return;
    }
    if (stayType === "OVERNIGHT" && checkOutVal <= checkInVal) {
      setError("Check-out must be after check-in");
      return;
    }
    const offer = (listing.roomTypes || []).find(
      (r: { id: string }) => r.id === (selectedRoomId || form.get("roomTypeId")),
    );
    const kind = String(offer?.offerKind || "ROOM").toUpperCase();
    const stayStyle = kind === "ROOM" || kind === "DAY_PASS";
    const bookingStayType = stayStyle ? stayType : "DAYUSE";
    if (bookingStayType === "DAYUSE" && dayStartTime >= dayEndTime) {
      setError("End time must be after start time");
      return;
    }
    const method = paymentMethod || String(form.get("paymentMethod") || "");
    if (method === "CARD") {
      const cardError = validateCardInput(card);
      if (cardError) {
        setError(cardError);
        return;
      }
    }
    if (method === "MPESA" && !String(form.get("phone") || "").trim()) {
      setError("Enter your M-Pesa phone number");
      return;
    }

    const guestName = String(form.get("guestName") || "").trim();
    const guestEmail = String(form.get("guestEmail") || "").trim();
    const guestPhone = String(form.get("guestPhone") || "").trim();
    if (!session?.user) {
      if (!guestCheckout) {
        setError("Choose Join as a member, or Continue without joining");
        return;
      }
      if (!guestName || !guestEmail) {
        setError("Enter your name and email so we can send your receipt");
        return;
      }
    }

    setPaying(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          roomTypeId: selectedRoomId || form.get("roomTypeId") || undefined,
          checkIn: checkInVal,
          checkOut: bookingStayType === "OVERNIGHT" ? checkOutVal : undefined,
          stayType: bookingStayType,
          dayStartTime:
            bookingStayType === "DAYUSE" ? dayStartTime : undefined,
          dayEndTime: bookingStayType === "DAYUSE" ? dayEndTime : undefined,
          guests: Number(form.get("guests") || 1),
          roomsBooked: Number(form.get("roomsBooked") || 1),
          paymentMethod: method,
          phone: form.get("phone") || guestPhone || undefined,
          card: method === "CARD" ? card : undefined,
          guestName: session?.user ? undefined : guestName,
          guestEmail: session?.user ? undefined : guestEmail,
          guestPhone: session?.user ? undefined : guestPhone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        setPaying(false);
        return;
      }
      if (data.payment?.pendingMpesa && data.booking?.id) {
        setSuccess(
          data.payment.message ||
            "M-Pesa prompt sent — enter your PIN on your phone.",
        );
        setMpesaWait({
          bookingId: data.booking.id,
          reference: data.booking.reference,
          receiptUrl: data.receiptUrl,
          confirmationUrl: data.confirmationUrl,
          accessToken: data.accessToken,
        });
        return;
      }
      if (method === "CARD") {
        setSuccess(
          data.payment?.message
            ? `${data.payment.message} · Booking ${data.booking.reference}`
            : `Paid · Booking ${data.booking.reference}`,
        );
        setCard({ number: "", name: "", expiry: "", cvc: "" });
      } else if (method === "CASH_ON_ARRIVAL") {
        setSuccess(
          `Reservation ${data.booking.reference} held — pay on arrival`,
        );
      } else {
        setSuccess(`Booked ${data.booking.reference}`);
      }
      if (data.receiptUrl) {
        setReceiptUrl(data.receiptUrl);
      }
      if (data.confirmationUrl) {
        setConfirmationUrl(data.confirmationUrl);
        window.location.href = data.confirmationUrl;
        return;
      }
      if (data.guestCheckout) {
        setGuestHint(true);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setPaying(false);
    }
  }

  async function askProvider(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAskMsg(null);
    if (!session?.user) {
      window.location.href = `/login?callbackUrl=/listings/${id}`;
      return;
    }
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: listing.id,
        message: form.get("message"),
        subject: listing.title,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAskMsg(data.error || "Could not send message");
      return;
    }
    setAskMsg("Message sent — reply in Messages.");
    e.currentTarget.reset();
  }

  if (!listing && !error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-sm text-ink-muted">Loading listing…</p>
        <div className="mt-6 h-48 animate-pulse bg-sand-deep/60" />
      </div>
    );
  }
  if (error && !listing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-red-700">{error}</p>
        <Link href="/browse" className="mt-4 inline-block text-sm text-lake-bright underline">
          ← Back to browse
        </Link>
      </div>
    );
  }

  const cover =
    listing.media?.find((m: { isCover?: boolean }) => m.isCover) ||
    listing.media?.[0];
  const gallery = (listing.media || []).slice(0, 4);
  const placePhone = listing.phone || listing.provider?.phone || null;
  const whatsapp = placePhone
    ? `https://wa.me/${String(placePhone).replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I found ${listing.title} on Safari Hub`)}`
    : null;
  const reviews = listing.reviews || [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce(
          (sum: number, r: { rating?: number }) => sum + (r.rating || 0),
          0,
        ) / reviews.length
      : null;
  const offers = listing.roomTypes || [];
  const selectedOffer = offers.find(
    (r: { id: string }) => r.id === selectedRoomId,
  );
  const selectedKind = String(selectedOffer?.offerKind || "ROOM").toUpperCase();
  const isStayStyleOffer =
    selectedKind === "ROOM" || selectedKind === "DAY_PASS";
  const isTicketOrActivity =
    selectedKind === "TICKET" ||
    selectedKind === "ACTIVITY" ||
    selectedKind === "PACKAGE" ||
    selectedKind === "TABLE";
  const guestsLabel = isTicketOrActivity
    ? selectedKind === "TICKET"
      ? "Tickets / seats"
      : selectedKind === "TABLE"
        ? "Guests at table"
        : "People"
    : "Guests";
  const dateLabel =
    selectedKind === "TICKET"
      ? "Event date"
      : selectedKind === "ACTIVITY"
        ? "Tour / activity date"
        : selectedKind === "PACKAGE"
          ? "Start date"
          : selectedKind === "TABLE"
            ? "Dining date"
            : "Visit date";

  // Non-stay offers book as a same-day dated visit
  const effectiveStayType = isStayStyleOffer ? stayType : "DAYUSE";
  const hasPin = listing.latitude != null && listing.longitude != null;
  const mapsDirections = hasPin
    ? googleMapsDirectionsUrl({
        destLat: listing.latitude,
        destLng: listing.longitude,
      })
    : null;
  const mapsPlace = hasPin
    ? googleMapsPlaceUrl(listing.latitude, listing.longitude, listing.title)
    : null;

  const locationLabel = [
    listing.county?.country?.name,
    listing.county?.name,
    listing.town?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/browse" className="text-sm text-lake-bright underline">
          ← Browse
        </Link>
        <div className="flex items-center gap-2">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-lake-bright"
            >
              WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => void toggleSave()}
            disabled={saving}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              saved
                ? "border-sun bg-sun/20 text-ink"
                : "border-line bg-white/70 text-ink-muted hover:border-lake-bright"
            }`}
          >
            {saved ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
      </div>

      {/* Photo strip */}
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        <div className="aspect-[4/3] overflow-hidden bg-sand-deep sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:min-h-[280px]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        {gallery.slice(1, 4).map((m: { id: string; url: string }) => (
          <div key={m.id} className="hidden aspect-[4/3] overflow-hidden bg-sand-deep sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>

      {(() => {
        const flyer = (listing.media || []).find((m: { alt?: string | null }) => {
          const a = (m.alt || "").toLowerCase();
          return a === "flyer" || a === "event-flyer" || a.includes("flyer");
        });
        if (!flyer) return null;
        return (
          <div className="mt-6 border border-line bg-white/70 p-4 sm:p-5">
            <h2 className="font-display text-xl font-semibold text-lake">
              Event flyer
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Official poster for this event — share or screenshot.
            </p>
            <div className="mt-4 max-w-md overflow-hidden border border-line bg-sand-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={flyer.url}
                alt={`${listing.title} flyer`}
                className="w-full object-contain"
              />
            </div>
            <a
              href={flyer.url}
              target="_blank"
              rel="noreferrer"
              download
              className="mt-3 inline-block text-sm text-lake-bright underline"
            >
              Open / download flyer
            </a>
          </div>
        );
      })()}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            {listing.title}
          </h1>
          <p className="mt-2 text-sm font-medium text-ink">
            {listingTypeLine(listing)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>{locationLabel}</span>
            {listing.provider?.name ? (
              <>
                <span aria-hidden>·</span>
                {listing.provider.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.provider.logoUrl}
                    alt=""
                    className="size-5 rounded object-contain"
                  />
                ) : null}
                {listing.provider?.slug ? (
                  <Link
                    href={publicProviderPath(listing.provider)}
                    className="text-lake-bright underline"
                  >
                    {listing.provider.name}
                  </Link>
                ) : (
                  <span>{listing.provider.name}</span>
                )}
              </>
            ) : null}
            {avgRating != null && (
              <>
                <span aria-hidden>·</span>
                <a href="#reviews" className="text-ink underline-offset-2 hover:underline">
                  {avgRating.toFixed(1)} ★ ({reviews.length})
                </a>
              </>
            )}
          </p>

          <ListingPlaceInfo
            title={listing.title}
            address={listing.address}
            phone={placePhone}
            website={listing.website}
            menuUrl={listing.menuUrl}
            openingHours={listing.openingHours}
            latitude={listing.latitude}
            longitude={listing.longitude}
            avgRating={avgRating}
            reviewCount={reviews.length}
          />

          {listing.description && (
            <section className="mt-8">
              <h2 className="font-display text-xl">About</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {listing.description}
              </p>
            </section>
          )}

          {listing.provider?.termsAndConditions?.trim() ? (
            <section className="mt-8">
              <h2 className="font-display text-xl">
                Terms &amp; conditions
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                From {listing.provider.name}
              </p>
              <div className="mt-3 whitespace-pre-wrap rounded-xl border border-line/70 bg-sand/30 px-4 py-3 text-sm leading-relaxed text-ink">
                {listing.provider.termsAndConditions}
              </div>
            </section>
          ) : null}

          <ListingAmenitiesPanel
            amenities={
              Array.isArray(listing.amenities) ? listing.amenities : []
            }
            offers={offers}
            stayType={stayType}
            selectedOfferId={selectedRoomId}
            onSelectOffer={setSelectedRoomId}
          />

          {/* Single location block — no duplicate directions panels */}
          {hasPin && (
            <section className="mt-8" id="location">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl">Location</h2>
                  {listing.address && (
                    <p className="mt-1 text-sm text-ink-muted">
                      {listing.address}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapsDirections && (
                    <a
                      href={mapsDirections}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-lake px-3 py-2 text-xs font-semibold text-sand"
                    >
                      Get directions
                    </a>
                  )}
                  {mapsPlace && (
                    <a
                      href={mapsPlace}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-line px-3 py-2 text-xs font-medium text-ink-muted hover:border-lake-bright"
                    >
                      Open map
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-3 overflow-hidden border border-line">
                <iframe
                  title="Map"
                  className="h-48 w-full sm:h-56"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.longitude - 0.04}%2C${listing.latitude - 0.04}%2C${listing.longitude + 0.04}%2C${listing.latitude + 0.04}&layer=mapnik&marker=${listing.latitude}%2C${listing.longitude}`}
                />
              </div>
            </section>
          )}

          <section className="mt-8" id="reviews">
            <h2 className="font-display text-xl">Reviews</h2>
            {avgRating != null ? (
              <p className="mt-1 text-sm text-ink-muted">
                {avgRating.toFixed(1)} ★ · {reviews.length} review
                {reviews.length === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">No reviews yet.</p>
            )}
            <ul className="mt-4 space-y-4">
              {reviews.slice(0, 5).map((r: any) => (
                <li key={r.id} className="border-b border-line pb-3 text-sm">
                  <p className="font-medium">
                    {r.rating}/5 · {r.traveler?.name || "Guest"}
                  </p>
                  {r.comment && (
                    <p className="mt-1 text-ink-muted">{r.comment}</p>
                  )}
                  {r.reply && (
                    <p className="mt-1 text-lake">Host: {r.reply}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8 border-t border-line pt-6">
            <button
              type="button"
              onClick={() => setAskOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-display text-xl">Ask a question</span>
              <span className="text-sm text-ink-muted">
                {askOpen ? "Hide" : "Show"}
              </span>
            </button>
            {askOpen && (
              <form onSubmit={askProvider} className="mt-4 space-y-3">
                {!session?.user && (
                  <p className="text-sm text-ink-muted">
                    <Link
                      href={`/login?callbackUrl=/listings/${id}`}
                      className="text-lake-bright underline"
                    >
                      Sign in
                    </Link>{" "}
                    to message the provider.
                  </p>
                )}
                <textarea
                  name="message"
                  required
                  minLength={2}
                  rows={3}
                  disabled={!session?.user}
                  placeholder="Ask about rooms, rates, or availability…"
                  className="w-full rounded-md border border-line px-3 py-2 text-sm disabled:opacity-60"
                />
                {askMsg && (
                  <p className="text-sm text-lake-bright">
                    {askMsg}{" "}
                    <Link href="/account/messages" className="underline">
                      Messages →
                    </Link>
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!session?.user}
                  className="rounded-md border border-lake px-4 py-2 text-sm font-semibold text-lake disabled:opacity-50"
                >
                  Send message
                </button>
              </form>
            )}
          </section>
        </div>

        {/* Sticky book panel */}
        <form
          id="book"
          onSubmit={book}
          className="h-fit space-y-4 border border-line bg-white/90 p-5 lg:sticky lg:top-6"
        >
          <div>
            <h2 className="font-display text-xl">Book</h2>
            {selectedOffer && (
              <p className="mt-1 text-sm text-ink-muted">
                {selectedOffer.name} ·{" "}
                {offerKindLabel(selectedOffer.offerKind)} · from KES{" "}
                {(effectiveStayType === "DAYUSE" &&
                selectedOffer.dayUsePrice > 0
                  ? selectedOffer.dayUsePrice
                  : selectedOffer.basePrice
                ).toLocaleString()}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              {[
                listing.acceptMpesa && "M-Pesa",
                listing.acceptCard && "Card",
                listing.acceptCashOnArrival && "Cash on arrival",
              ]
                .filter(Boolean)
                .join(" · ") || "Ask the host about payment"}
            </p>
            {!session?.user ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-ink-muted">
                  Members can cancel and rebook from My trips. Optional — you
                  can also book once as a guest.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href={`/register?callbackUrl=${encodeURIComponent(`/listings/${id}#book`)}`}
                    className="inline-flex items-center justify-center rounded-md bg-lake px-3 py-2.5 text-center text-sm font-semibold text-sand transition hover:bg-lake-bright"
                  >
                    Join as a member
                  </Link>
                  <button
                    type="button"
                    onClick={() => setGuestCheckout(true)}
                    className={`rounded-md border px-3 py-2.5 text-sm font-medium transition ${
                      guestCheckout
                        ? "border-lake bg-lake/10 text-lake"
                        : "border-line text-ink hover:border-lake-bright"
                    }`}
                  >
                    Continue without joining
                  </button>
                </div>
                {!guestCheckout && (
                  <p className="text-center text-xs text-ink-muted">
                    Already have an account?{" "}
                    <Link
                      href={`/login?callbackUrl=/listings/${id}#book`}
                      className="text-lake-bright underline"
                    >
                      Log in
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-muted">
                Booking as a member — cancel or rebook from{" "}
                <Link href="/account" className="text-lake-bright underline">
                  My trips
                </Link>
                .
              </p>
            )}
          </div>

          {(session?.user || guestCheckout) && (
            <>
          {!session?.user && (
            <div className="space-y-3 rounded-md border border-line/80 bg-sand/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Guest details
                </p>
                <button
                  type="button"
                  onClick={() => setGuestCheckout(false)}
                  className="text-xs text-ink-muted underline hover:text-ink"
                >
                  Back
                </button>
              </div>
              <label className="block text-sm">
                Full name
                <input
                  name="guestName"
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="As on your ID"
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
                  placeholder="For receipt & booking details"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  name="guestPhone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="07… (optional unless paying by M-Pesa)"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
            </div>
          )}

          {(isStayStyleOffer &&
            (listing.allowOvernight !== false ||
              listing.allowDayUse !== false)) && (
            <div className="grid grid-cols-2 gap-2">
              {listing.allowOvernight !== false && (
                <button
                  type="button"
                  onClick={() => setStayType("OVERNIGHT")}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    stayType === "OVERNIGHT"
                      ? "border-lake bg-lake/10 font-semibold text-lake"
                      : "border-line text-ink-muted"
                  }`}
                >
                  Overnight
                </button>
              )}
              {listing.allowDayUse !== false && (
                <button
                  type="button"
                  onClick={() => setStayType("DAYUSE")}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    stayType === "DAYUSE"
                      ? "border-lake bg-lake/10 font-semibold text-lake"
                      : "border-line text-ink-muted"
                  }`}
                >
                  Daytime
                </button>
              )}
            </div>
          )}

          {!isStayStyleOffer && (
            <p className="rounded-md bg-sand-deep/40 px-3 py-2 text-xs text-ink-muted">
              Booking a {offerKindLabel(selectedKind).toLowerCase()} — pick the
              date (and time) you want to attend or start.
            </p>
          )}

          <label className="block text-sm">
            Offer
            <select
              name="roomTypeId"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              {offers.map((r: any) => {
                const dayPrice =
                  r.dayUsePrice != null && r.dayUsePrice > 0
                    ? r.dayUsePrice
                    : r.basePrice;
                const price =
                  effectiveStayType === "DAYUSE" ? dayPrice : r.basePrice;
                const tourist = formatPriceTourist(
                  price,
                  trust?.displayCurrency || "KES",
                );
                return (
                  <option key={r.id} value={r.id}>
                    {r.name} · {tourist.primary}
                    {tourist.approx ? ` (${tourist.approx})` : ""}
                  </option>
                );
              })}
            </select>
          </label>

          {effectiveStayType === "OVERNIGHT" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Check-in
                <input
                  name="checkIn"
                  type="date"
                  required
                  min={minCheckIn}
                  value={checkIn}
                  onChange={(e) => {
                    const next = e.target.value || minCheckIn;
                    setCheckIn(next);
                    const earliestOut = addDaysISO(next, 1);
                    if (checkOut <= next) setCheckOut(earliestOut);
                  }}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Check-out
                <input
                  name="checkOut"
                  type="date"
                  required
                  min={minCheckOut}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value || minCheckOut)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
            </div>
          ) : (
            <>
              <label className="block text-sm">
                {dateLabel}
                <input
                  name="checkIn"
                  type="date"
                  required
                  min={minCheckIn}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value || minCheckIn)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  {selectedKind === "TICKET" ? "Doors" : "Start"}
                  <input
                    type="time"
                    value={dayStartTime}
                    onChange={(e) => setDayStartTime(e.target.value || "10:00")}
                    className="mt-1 w-full rounded-md border border-line px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  {selectedKind === "TICKET" ? "Ends" : "End"}
                  <input
                    type="time"
                    value={dayEndTime}
                    onChange={(e) => setDayEndTime(e.target.value || "18:00")}
                    className="mt-1 w-full rounded-md border border-line px-3 py-2"
                  />
                </label>
              </div>
            </>
          )}

          <label className="block text-sm">
            {guestsLabel}
            <input
              name="guests"
              type="number"
              min={1}
              defaultValue={1}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            Payment
            <select
              name="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              {listing.acceptMpesa && <option value="MPESA">M-Pesa</option>}
              {listing.acceptCard && (
                <option value="CARD">Card (Visa / Mastercard)</option>
              )}
              {listing.acceptCashOnArrival && (
                <option value="CASH_ON_ARRIVAL">Cash on arrival</option>
              )}
            </select>
          </label>

          {paymentMethod === "MPESA" && (
            <label className="block text-sm">
              M-Pesa phone
              <input
                name="phone"
                placeholder="07… or 2547…"
                required
                disabled={!!mpesaWait}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 disabled:opacity-60"
              />
            </label>
          )}

          {paymentMethod === "CARD" && listing.acceptCard && (
            <CardPaymentForm values={card} onChange={setCard} />
          )}

          <BookingTrustStrip
            supportEmail={trust?.supportEmail}
            supportPhone={trust?.supportPhone}
            cancellationHours={trust?.cancellationHours}
          />

          {mpesaWait && (
            <div className="rounded-md border border-lake/30 bg-lake/5 px-3 py-2 text-xs text-ink-muted">
              Enter your M-Pesa PIN on your phone. Booking{" "}
              <strong className="text-ink">{mpesaWait.reference}</strong>{" "}
              confirms only after payment succeeds.
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm text-lake-bright">{success}</p>}
          {confirmationUrl && (
            <p className="text-sm">
              <Link
                href={confirmationUrl}
                className="font-semibold text-lake-bright underline"
              >
                Open confirmation &amp; voucher →
              </Link>
            </p>
          )}
          {receiptUrl && (
            <p className="text-sm">
              <Link
                href={receiptUrl}
                className="font-semibold text-lake-bright underline"
              >
                View receipt →
              </Link>
            </p>
          )}
          {guestHint && (
            <p className="text-xs leading-relaxed text-ink-muted">
              Your confirmation link lets you cancel or print a voucher without
              an account.{" "}
              <Link href="/register" className="font-semibold text-lake-bright underline">
                Create a free member account
              </Link>{" "}
              to keep all trips in one place.
            </p>
          )}

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
                  : paymentMethod === "CARD"
                    ? "Charging…"
                    : "Booking…"
                : paymentMethod === "MPESA"
                  ? "Pay with M-Pesa"
                  : paymentMethod === "CARD"
                    ? "Pay & book"
                    : "Confirm booking"}
          </button>
            </>
          )}

          <p className="text-center text-xs text-ink-muted">
            <a href="#amenities" className="underline hover:text-lake">
              Browse amenities &amp; rooms
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
