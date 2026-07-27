"use client";

import { useState } from "react";
import {
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  normalizeWebsiteUrl,
} from "@/lib/geo";

type Props = {
  title: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  menuUrl?: string | null;
  openingHours?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avgRating?: number | null;
  reviewCount?: number;
};

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function ListingPlaceInfo({
  title,
  address,
  phone,
  website,
  menuUrl,
  openingHours,
  latitude,
  longitude,
  avgRating,
  reviewCount = 0,
}: Props) {
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const site = normalizeWebsiteUrl(website);
  const menu = normalizeWebsiteUrl(menuUrl);
  const call = phone ? telHref(phone) : null;
  const hasPin = latitude != null && longitude != null;
  const mapsPlace = hasPin
    ? googleMapsPlaceUrl(latitude, longitude, title)
    : null;
  const mapsDirections = hasPin
    ? googleMapsDirectionsUrl({ destLat: latitude, destLng: longitude })
    : null;

  async function shareLocation() {
    setShareMsg(null);
    const pageUrl =
      typeof window !== "undefined" ? window.location.href : "";
    const mapsUrl = mapsPlace || pageUrl;
    const text = [
      title,
      address || null,
      phone ? `Call: ${phone}` : null,
      site ? `Website: ${site}` : null,
      mapsUrl ? `Location: ${mapsUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text: address ? `${title} — ${address}` : title,
          url: mapsUrl || pageUrl,
        });
        setShareMsg("Shared");
        return;
      }
    } catch (err) {
      // User cancelled share sheet — ignore
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareMsg("Location copied — paste anywhere to share");
    } catch {
      setShareMsg(mapsUrl || "Could not copy");
    }
  }

  const actions: Array<{
    key: string;
    label: string;
    href?: string;
    onClick?: () => void;
    external?: boolean;
    disabled?: boolean;
  }> = [
    {
      key: "call",
      label: "Call",
      href: call || undefined,
      disabled: !call,
    },
    {
      key: "directions",
      label: "Directions",
      href: mapsDirections || undefined,
      external: true,
      disabled: !mapsDirections,
    },
    {
      key: "website",
      label: "Website",
      href: site || undefined,
      external: true,
      disabled: !site,
    },
    {
      key: "menu",
      label: "Menu",
      href: menu || undefined,
      external: true,
      disabled: !menu,
    },
    {
      key: "share",
      label: "Share",
      onClick: () => void shareLocation(),
    },
  ];

  return (
    <div className="mt-5 border border-line bg-white/85">
      <div className="border-b border-line px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Place info
        </p>
        {reviewCount > 0 && avgRating != null && (
          <p className="mt-1 text-sm text-ink">
            <span className="font-semibold">{avgRating.toFixed(1)}</span>
            <span className="text-sun"> ★</span>
            <span className="text-ink-muted">
              {" "}
              · {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </span>
          </p>
        )}
        {address && (
          <p className="mt-1 text-sm text-ink-muted">{address}</p>
        )}
        {openingHours && (
          <p className="mt-1 text-sm text-ink">
            <span className="text-ink-muted">Hours · </span>
            {openingHours}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px bg-line sm:grid-cols-5">
        {actions.map((a) => {
          const className =
            "flex flex-col items-center justify-center gap-1 bg-white px-2 py-3 text-center text-xs font-semibold transition hover:bg-sand-deep/40 disabled:cursor-not-allowed disabled:opacity-40";
          if (a.onClick) {
            return (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                className={`${className} text-lake`}
              >
                <ActionIcon name={a.key} />
                {a.label}
              </button>
            );
          }
          if (!a.href || a.disabled) {
            return (
              <span
                key={a.key}
                className={`${className} text-ink-muted`}
                aria-disabled
              >
                <ActionIcon name={a.key} />
                {a.label}
              </span>
            );
          }
          return (
            <a
              key={a.key}
              href={a.href}
              target={a.external ? "_blank" : undefined}
              rel={a.external ? "noreferrer" : undefined}
              className={`${className} text-lake`}
            >
              <ActionIcon name={a.key} />
              {a.label}
            </a>
          );
        })}
      </div>

      {shareMsg && (
        <p className="border-t border-line px-4 py-2 text-xs text-lake-bright">
          {shareMsg}
        </p>
      )}
    </div>
  );
}

function ActionIcon({ name }: { name: string }) {
  const common = "h-5 w-5";
  switch (name) {
    case "call":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.4 21 3 13.6 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "directions":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3l8 8-8 8-8-8 8-8z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M12 8v5l3 2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "website":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "menu":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 4h10v16H7z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 8h6M9 12h6M9 16h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M8.5 11l7-5M8.5 13l7 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
