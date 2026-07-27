/** Haversine distance in kilometres between two WGS84 points. */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Rough drive-time estimate at ~40 km/h urban average (Kenya towns). */
export function estimateDriveMinutes(km: number): number {
  return Math.max(1, Math.round((km / 40) * 60));
}

export function googleMapsDirectionsUrl(opts: {
  destLat: number;
  destLng: number;
  originLat?: number;
  originLng?: number;
}): string {
  const dest = `${opts.destLat},${opts.destLng}`;
  if (opts.originLat != null && opts.originLng != null) {
    const origin = `${opts.originLat},${opts.originLng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

export function openStreetMapDirectionsUrl(opts: {
  destLat: number;
  destLng: number;
  originLat?: number;
  originLng?: number;
}): string {
  if (opts.originLat != null && opts.originLng != null) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${opts.originLat}%2C${opts.originLng}%3B${opts.destLat}%2C${opts.destLng}`;
  }
  return `https://www.openstreetmap.org/?mlat=${opts.destLat}&mlon=${opts.destLng}#map=15/${opts.destLat}/${opts.destLng}`;
}

/** Google Maps place pin — same style tourists share from Maps. */
export function googleMapsPlaceUrl(lat: number, lng: number, label?: string): string {
  const q =
    label && label.trim()
      ? `${label.trim()}@${lat},${lng}`
      : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function normalizeWebsiteUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
