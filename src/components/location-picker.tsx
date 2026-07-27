"use client";

import { useEffect, useMemo, useState } from "react";

type Place = {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
};

type Props = {
  countryId: string;
  countyId: string;
  townId: string;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  /** Hide GPS + map (use on quick-create forms). */
  compact?: boolean;
  /** Map iframe height class, e.g. h-64 or h-72 */
  mapClassName?: string;
  onChange: (next: {
    countryId?: string;
    countyId?: string;
    townId?: string;
    latitude?: number | null;
    longitude?: number | null;
    locationConfirmed?: boolean;
  }) => void;
};

export function LocationPicker({
  countryId,
  countyId,
  townId,
  latitude,
  longitude,
  locationConfirmed,
  compact = false,
  mapClassName = "h-56 w-full",
  onChange,
}: Props) {
  const [countries, setCountries] = useState<Place[]>([]);
  const [counties, setCounties] = useState<Place[]>([]);
  const [towns, setTowns] = useState<Place[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setCountries(d.countries || []));
  }, []);

  useEffect(() => {
    if (!countryId) {
      setCounties([]);
      return;
    }
    void fetch(`/api/locations?countryId=${countryId}`)
      .then((r) => r.json())
      .then((d) => setCounties(d.counties || []));
  }, [countryId]);

  useEffect(() => {
    if (!countyId) {
      setTowns([]);
      return;
    }
    void fetch(`/api/locations?countyId=${countyId}`)
      .then((r) => r.json())
      .then((d) => setTowns(d.towns || []));
  }, [countyId]);

  const mapLat = latitude ?? towns.find((t) => t.id === townId)?.latitude ?? null;
  const mapLng =
    longitude ?? towns.find((t) => t.id === townId)?.longitude ?? null;

  const mapSrc = useMemo(() => {
    if (mapLat == null || mapLng == null) return null;
    const delta = 0.08;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - delta}%2C${mapLat - delta}%2C${mapLng + delta}%2C${mapLat + delta}&layer=mapnik&marker=${mapLat}%2C${mapLng}`;
  }, [mapLat, mapLng]);

  function pickTown(id: string) {
    const town = towns.find((t) => t.id === id);
    onChange({
      townId: id,
      latitude: town?.latitude ?? null,
      longitude: town?.longitude ?? null,
      locationConfirmed: false,
    });
  }

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported on this device");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationConfirmed: true,
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || "Could not get your location");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <p className="text-sm font-medium text-ink">Location</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          required
          value={countryId}
          onChange={(e) =>
            onChange({
              countryId: e.target.value,
              countyId: "",
              townId: "",
              latitude: null,
              longitude: null,
              locationConfirmed: false,
            })
          }
          className="rounded-md border border-line px-3 py-2"
        >
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          required
          value={countyId}
          disabled={!countryId}
          onChange={(e) =>
            onChange({
              countyId: e.target.value,
              townId: "",
              latitude: null,
              longitude: null,
              locationConfirmed: false,
            })
          }
          className="rounded-md border border-line px-3 py-2 disabled:opacity-50"
        >
          <option value="">County</option>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          required
          value={townId}
          disabled={!countyId}
          onChange={(e) => pickTown(e.target.value)}
          className="rounded-md border border-line px-3 py-2 disabled:opacity-50"
        >
          <option value="">Town</option>
          {towns.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {!compact && (
        <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={!townId || geoLoading}
          className="rounded-md border border-lake bg-lake/5 px-3 py-2 text-sm font-medium text-lake disabled:opacity-50"
        >
          {geoLoading
            ? "Getting GPS…"
            : "I am at this location — use my GPS"}
        </button>
        {locationConfirmed && mapLat != null && (
          <span className="text-xs text-lake-bright">
            GPS set: {mapLat.toFixed(5)}, {mapLng?.toFixed(5)}
          </span>
        )}
        {!locationConfirmed && mapLat != null && (
          <span className="text-xs text-ink-muted">
            Showing town centre — confirm with GPS if you are on site
          </span>
        )}
      </div>
      {geoError && <p className="text-sm text-red-700">{geoError}</p>}

      {mapSrc ? (
        <div className="overflow-hidden rounded-lg border border-line">
          <iframe
            title="Business location map"
            src={mapSrc}
            className={mapClassName}
            loading="lazy"
          />
          <a
            href={`https://www.openstreetmap.org/?mlat=${mapLat}&mlon=${mapLng}#map=14/${mapLat}/${mapLng}`}
            target="_blank"
            rel="noreferrer"
            className="block bg-sand/50 px-3 py-2 text-xs text-lake-bright underline"
          >
            Open full map
          </a>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Choose country → county → town to preview the map of your premises.
        </p>
      )}
        </>
      )}
      {compact && townId && (
        <p className="text-xs text-ink-muted">
          Map pin and GPS can be confirmed after you create the listing.
        </p>
      )}
    </div>
  );
}
