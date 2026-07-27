"use client";

import { useState } from "react";
import {
  distanceKm,
  estimateDriveMinutes,
  formatDistance,
  googleMapsDirectionsUrl,
  openStreetMapDirectionsUrl,
} from "@/lib/geo";

type Coords = { lat: number; lng: number };

export function ListingDirections({
  latitude,
  longitude,
  title,
  address,
}: {
  latitude: number;
  longitude: number;
  title: string;
  address?: string | null;
}) {
  const dest: Coords = { lat: latitude, lng: longitude };
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const km = origin ? distanceKm(origin, dest) : null;

  function locate() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Location is not supported in this browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            "Location permission denied. Allow location, or open Google Maps and enter your start point.",
          );
        } else {
          setError("Could not get your location. Try again outdoors or on mobile data.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  const gmaps = googleMapsDirectionsUrl({
    destLat: dest.lat,
    destLng: dest.lng,
    originLat: origin?.lat,
    originLng: origin?.lng,
  });
  const osm = openStreetMapDirectionsUrl({
    destLat: dest.lat,
    destLng: dest.lng,
    originLat: origin?.lat,
    originLng: origin?.lng,
  });

  return (
    <div className="mt-4 rounded-xl border border-line bg-white/80 p-4">
      <h2 className="font-display text-xl">Directions</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Get turn-by-turn directions from where you are to {title}.
        {address ? ` · ${address}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={loading}
          className="rounded-md bg-lake px-3 py-2 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {loading
            ? "Finding you…"
            : origin
              ? "Update my location"
              : "Use my location"}
        </button>
        <a
          href={gmaps}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-lake px-3 py-2 text-sm font-semibold text-lake"
        >
          {origin ? "Open in Google Maps" : "Open Google Maps"}
        </a>
        <a
          href={osm}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line px-3 py-2 text-sm text-ink-muted hover:border-lake-bright"
        >
          OpenStreetMap
        </a>
      </div>

      {km != null && (
        <p className="mt-3 text-sm text-ink">
          About{" "}
          <span className="font-semibold">{formatDistance(km)}</span> from
          you · ~{estimateDriveMinutes(km)} min drive (estimate)
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {origin && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <iframe
            title="Route preview"
            className="h-48 w-full"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(origin.lng, dest.lng) - 0.05}%2C${Math.min(origin.lat, dest.lat) - 0.05}%2C${Math.max(origin.lng, dest.lng) + 0.05}%2C${Math.max(origin.lat, dest.lat) + 0.05}&layer=mapnik&marker=${dest.lat}%2C${dest.lng}`}
          />
        </div>
      )}
    </div>
  );
}
