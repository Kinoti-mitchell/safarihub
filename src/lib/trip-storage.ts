/** Client-side multi-stop trip builder (localStorage). */

export type TripStop = {
  listingId: string;
  title: string;
  href: string;
  kind?: string;
  checkIn?: string;
  checkOut?: string;
  addedAt: string;
};

const KEY = "safari_hub_trip_v1";

export function readTrip(): TripStop[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TripStop[]).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function writeTrip(stops: TripStop[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(stops.slice(0, 20)));
  window.dispatchEvent(new Event("safari-hub-trip"));
}

export function addTripStop(stop: Omit<TripStop, "addedAt">) {
  const stops = readTrip().filter((s) => s.listingId !== stop.listingId);
  stops.push({ ...stop, addedAt: new Date().toISOString() });
  writeTrip(stops);
  return stops;
}

export function removeTripStop(listingId: string) {
  writeTrip(readTrip().filter((s) => s.listingId !== listingId));
}

export function clearTrip() {
  writeTrip([]);
}
