"use client";

import { useState } from "react";
import {
  amenityLabel,
  offerKindLabel,
  offerKindsForAmenity,
  type OfferKind,
} from "@/lib/amenities";

export type ListingOffer = {
  id: string;
  name: string;
  description?: string | null;
  offerKind?: string | null;
  basePrice: number;
  dayUsePrice?: number | null;
  quantity: number;
  maxGuests?: number;
  amenities?: unknown;
};

type Props = {
  amenities: string[];
  offers: ListingOffer[];
  stayType: "OVERNIGHT" | "DAYUSE";
  selectedOfferId: string;
  onSelectOffer: (id: string) => void;
};

function priceFor(offer: ListingOffer, stayType: "OVERNIGHT" | "DAYUSE") {
  if (stayType === "DAYUSE") {
    return offer.dayUsePrice != null && offer.dayUsePrice > 0
      ? offer.dayUsePrice
      : offer.basePrice;
  }
  return offer.basePrice;
}

function offerAmenities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => String(a));
}

export function ListingAmenitiesPanel({
  amenities,
  offers,
  stayType,
  selectedOfferId,
  onSelectOffer,
}: Props) {
  const roomOffers = offers.filter(
    (o) => !o.offerKind || o.offerKind === "ROOM",
  );
  const hasRooms = roomOffers.length > 0;

  const chips: Array<{
    key: string;
    label: string;
    kinds: OfferKind[] | "ALL" | null;
  }> = [];
  if (hasRooms) {
    chips.push({ key: "__rooms", label: "Rooms", kinds: ["ROOM"] });
  }
  if (offers.some((o) => o.offerKind && o.offerKind !== "ROOM")) {
    chips.push({ key: "__all", label: "All offers", kinds: "ALL" });
  }
  for (const key of amenities) {
    chips.push({
      key,
      label: amenityLabel(key),
      kinds: offerKindsForAmenity(key),
    });
  }

  const [active, setActive] = useState<string | null>(
    hasRooms ? "__rooms" : amenities[0] || (offers.length ? "__all" : null),
  );

  const activeChip = chips.find((c) => c.key === active) || null;

  let visibleOffers: ListingOffer[] = [];
  let hint: string | null = null;

  if (activeChip?.kinds === "ALL") {
    visibleOffers = offers;
    hint = "Everything you can book here";
  } else if (activeChip?.kinds) {
    visibleOffers = offers.filter((o) =>
      (activeChip.kinds as OfferKind[]).includes(
        (o.offerKind || "ROOM") as OfferKind,
      ),
    );
    if (activeChip.key === "__rooms") {
      hint = "Rooms & overnight stays — tap one to book";
    } else {
      hint = `${activeChip.label} — matching offers below`;
    }
    if (visibleOffers.length === 0) {
      hint = `${activeChip.label} is available on site. Ask the provider or pick another offer to book.`;
    }
  } else if (activeChip) {
    hint = `${activeChip.label} is available on site (not a separate bookable offer).`;
    visibleOffers = [];
  }

  if (chips.length === 0 && offers.length === 0) return null;

  return (
    <section className="mt-8" id="amenities">
      <h2 className="font-display text-xl">Amenities &amp; what to book</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Tap an amenity to see related rooms or offers. Tap an offer to select it
        for booking.
      </p>

      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const isActive = active === chip.key;
            const bookable = chip.kinds != null;
            return (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() =>
                    setActive((prev) => (prev === chip.key ? null : chip.key))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-lake bg-lake text-sand"
                      : bookable
                        ? "border-line bg-white text-ink hover:border-lake-bright"
                        : "border-line/80 bg-sand-deep/40 text-ink-muted hover:border-line"
                  }`}
                >
                  {chip.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hint && <p className="mt-3 text-sm text-ink-muted">{hint}</p>}

      {visibleOffers.length > 0 && (
        <ul className="mt-4 space-y-2">
          {visibleOffers.map((o) => {
            const selected = selectedOfferId === o.id;
            const price = priceFor(o, stayType);
            const roomAm = offerAmenities(o.amenities);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectOffer(o.id);
                    document
                      .getElementById("book")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full border px-4 py-3 text-left transition ${
                    selected
                      ? "border-lake bg-lake/10"
                      : "border-line bg-white/80 hover:border-lake-bright"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-base font-semibold text-ink">
                      {o.name}
                    </p>
                    <p className="text-sm font-semibold text-lake">
                      KES {price.toLocaleString()}
                      {stayType === "DAYUSE" ? " / day" : ""}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {offerKindLabel(o.offerKind)} · {o.quantity} available
                    {o.maxGuests ? ` · up to ${o.maxGuests} guests` : ""}
                    {selected ? " · selected for booking" : " · tap to book"}
                  </p>
                  {o.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                      {o.description}
                    </p>
                  )}
                  {roomAm.length > 0 && (
                    <p className="mt-2 text-xs text-ink-muted">
                      In this offer:{" "}
                      {roomAm.map((a) => amenityLabel(a)).join(" · ")}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
