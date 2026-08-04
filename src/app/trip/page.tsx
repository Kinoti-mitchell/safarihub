"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearTrip,
  readTrip,
  removeTripStop,
  writeTrip,
  type TripStop,
} from "@/lib/trip-storage";

export default function TripPlannerPage() {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setStops(readTrip());
  }

  useEffect(() => {
    refresh();
    function onStorage() {
      refresh();
    }
    window.addEventListener("safari-hub-trip", onStorage);
    window.addEventListener("storage", onStorage);

    // Hydrate from server if signed in (merge by listingId)
    void fetch("/api/trips")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!body?.stops?.length) return;
        const local = readTrip();
        const byId = new Map(local.map((s) => [s.listingId, s]));
        for (const s of body.stops as Array<Record<string, unknown>>) {
          const listingId = String(s.listingId || "");
          if (!listingId || byId.has(listingId)) continue;
          byId.set(listingId, {
            listingId,
            title: String(s.title || "Stop"),
            href: String(s.href || `/listings/${listingId}`),
            kind: s.kind ? String(s.kind) : undefined,
            checkIn: s.checkIn ? String(s.checkIn) : undefined,
            checkOut: s.checkOut ? String(s.checkOut) : undefined,
            addedAt: String(s.addedAt || new Date().toISOString()),
          });
        }
        const merged = Array.from(byId.values());
        writeTrip(merged);
        setStops(merged);
        if (body.trip?.shareToken) {
          setShareUrl(
            `${window.location.origin}/trip/share/${body.trip.shareToken}`,
          );
        }
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener("safari-hub-trip", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function syncToServer() {
    setBusy(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/trips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "My trip",
          stops: stops.map((s, i) => ({
            listingId: s.listingId,
            title: s.title,
            href: s.href,
            kind: s.kind,
            checkIn: s.checkIn,
            checkOut: s.checkOut,
            sortOrder: i,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMsg(
          res.status === 401
            ? "Sign in to sync your trip across devices"
            : body.error || "Could not sync",
        );
        return;
      }
      if (body.trip?.shareToken) {
        setShareUrl(
          `${window.location.origin}/trip/share/${body.trip.shareToken}`,
        );
      }
      setSyncMsg("Synced to your account");
    } catch {
      setSyncMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Your trip
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Multi-stop plan — stay and tour first. Saved on this device; sign in and
        sync to keep it on your account and share a link.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !stops.length}
          onClick={() => void syncToServer()}
          className="rounded-md bg-lake px-3 py-2 text-sm font-semibold text-sand disabled:opacity-50"
        >
          {busy ? "Syncing…" : "Sync to account"}
        </button>
        {shareUrl && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(shareUrl);
              setSyncMsg("Share link copied");
            }}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            Copy share link
          </button>
        )}
      </div>
      {syncMsg && <p className="mt-2 text-xs text-ink-muted">{syncMsg}</p>}

      <ul className="mt-8 space-y-3">
        {stops.map((s, i) => (
          <li
            key={`${s.listingId}-${s.addedAt}`}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white/70 px-4 py-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Stop {i + 1}
                {s.kind ? ` · ${s.kind}` : ""}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">
                {s.title}
              </p>
              {(s.checkIn || s.checkOut) && (
                <p className="mt-1 text-sm text-ink-muted">
                  {s.checkIn || "—"}
                  {s.checkOut ? ` → ${s.checkOut}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={s.href}
                className="rounded-md bg-lake px-3 py-1.5 text-xs font-semibold text-sand"
              >
                Book
              </Link>
              <button
                type="button"
                onClick={() => {
                  removeTripStop(s.listingId);
                  refresh();
                }}
                className="rounded-md border border-line px-3 py-1.5 text-xs"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {!stops.length && (
          <li className="rounded-xl border border-dashed border-line bg-white/40 px-4 py-12 text-center text-sm text-ink-muted">
            No stops yet. Open a listing and tap{" "}
            <span className="font-medium text-ink">Add to trip</span>.
            <div className="mt-4">
              <Link
                href="/browse?category=explore"
                className="font-semibold text-lake-bright underline"
              >
                Browse tours
              </Link>
              {" · "}
              <Link
                href="/browse?category=stays"
                className="font-semibold text-lake-bright underline"
              >
                Browse stays
              </Link>
            </div>
          </li>
        )}
      </ul>

      {stops.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clearTrip();
            refresh();
            setShareUrl(null);
          }}
          className="mt-6 text-sm text-ink-muted underline"
        >
          Clear trip
        </button>
      )}
    </div>
  );
}
