export type ListingCompleteness = {
  complete: boolean;
  checks: {
    description: boolean;
    photo: boolean;
    offer: boolean;
    location: boolean;
  };
};

export function listingCompleteness(listing: {
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  media: unknown[];
  roomTypes: unknown[];
  /** When PLACE is included, a map pin is required. */
  listingKinds?: unknown;
}): ListingCompleteness {
  const kinds = Array.isArray(listing.listingKinds)
    ? listing.listingKinds.map((k) => String(k).toUpperCase())
    : ["PLACE"];
  const needsMap = kinds.includes("PLACE") || kinds.length === 0;

  const checks = {
    description: Boolean(listing.description?.trim()),
    photo: listing.media.length > 0,
    offer: listing.roomTypes.length > 0,
    location: needsMap
      ? listing.latitude != null && listing.longitude != null
      : true,
  };
  return {
    complete: Object.values(checks).every(Boolean),
    checks,
  };
}

export function publicListingPath(listing: { id: string; slug: string }) {
  return `/listings/${listing.slug || listing.id}`;
}

export function publicProviderPath(provider: { slug: string }) {
  return `/providers/${provider.slug}`;
}
