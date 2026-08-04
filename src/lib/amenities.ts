/**
 * Venue amenities providers can tick when creating/editing a listing.
 * Not Airbnb-only — covers hotels, restaurants, pools, cinemas, venues, etc.
 */

export type AmenityDef = {
  key: string;
  label: string;
  /** Hint categories where this amenity is especially relevant. */
  forCategories?: Array<"STAY" | "EAT" | "MOVE" | "EXPLORE" | "MEET" | "ALL">;
};

export const AMENITIES: AmenityDef[] = [
  { key: "restaurant", label: "Restaurant", forCategories: ["ALL"] },
  { key: "bar", label: "Bar / lounge", forCategories: ["ALL"] },
  { key: "cafe", label: "Café", forCategories: ["EAT", "STAY", "EXPLORE"] },
  { key: "swimming_pool", label: "Swimming pool", forCategories: ["ALL"] },
  { key: "kids_pool", label: "Kids pool", forCategories: ["STAY", "EXPLORE", "MEET"] },
  { key: "gym", label: "Gym / fitness", forCategories: ["STAY", "MEET"] },
  { key: "spa", label: "Spa / wellness", forCategories: ["STAY", "EXPLORE"] },
  { key: "sauna", label: "Sauna / steam", forCategories: ["STAY"] },
  { key: "wifi", label: "Wi‑Fi", forCategories: ["ALL"] },
  { key: "parking", label: "Parking", forCategories: ["ALL"] },
  { key: "ev_charging", label: "EV charging", forCategories: ["STAY", "MEET"] },
  { key: "air_conditioning", label: "Air conditioning", forCategories: ["ALL"] },
  { key: "conference", label: "Conference / meeting rooms", forCategories: ["MEET", "STAY"] },
  { key: "events_space", label: "Events space", forCategories: ["MEET", "STAY", "EAT"] },
  { key: "garden", label: "Garden / outdoor seating", forCategories: ["ALL"] },
  { key: "rooftop", label: "Rooftop", forCategories: ["EAT", "STAY", "MEET"] },
  { key: "live_music", label: "Live music", forCategories: ["EAT", "EXPLORE"] },
  { key: "cinema", label: "Cinema / movie screen", forCategories: ["EXPLORE", "MEET"] },
  { key: "bowling", label: "Bowling", forCategories: ["EXPLORE", "MEET"] },
  { key: "arcade", label: "Arcade / games", forCategories: ["EXPLORE", "MEET"] },
  { key: "kids_play", label: "Kids play area", forCategories: ["ALL"] },
  { key: "pet_friendly", label: "Pet friendly", forCategories: ["ALL"] },
  { key: "wheelchair", label: "Wheelchair accessible", forCategories: ["ALL"] },
  { key: "room_service", label: "Room service", forCategories: ["STAY"] },
  { key: "laundry", label: "Laundry", forCategories: ["STAY"] },
  { key: "airport_shuttle", label: "Airport shuttle", forCategories: ["STAY", "MOVE"] },
  { key: "car_hire", label: "Car hire", forCategories: ["MOVE", "STAY"] },
  { key: "guided_tours", label: "Guided tours", forCategories: ["EXPLORE", "STAY"] },
  { key: "beach_access", label: "Beach access", forCategories: ["STAY", "EXPLORE"] },
  { key: "bbq", label: "BBQ / nyama choma", forCategories: ["EAT", "STAY", "MEET"] },
  { key: "takeaway", label: "Takeaway", forCategories: ["EAT"] },
  { key: "delivery", label: "Delivery", forCategories: ["EAT"] },
  { key: "halal", label: "Halal options", forCategories: ["EAT", "STAY"] },
  { key: "vegetarian", label: "Vegetarian options", forCategories: ["EAT", "STAY"] },
  { key: "security", label: "24h security", forCategories: ["STAY", "MEET"] },
  { key: "generator", label: "Backup power", forCategories: ["ALL"] },
];

export const OFFER_KINDS = [
  { key: "ROOM", label: "Room / overnight stay", hint: "Hotel room, suite, cottage" },
  { key: "DAY_PASS", label: "Day pass", hint: "Pool day, spa day, club access" },
  { key: "TABLE", label: "Table / dining", hint: "Restaurant booking, set menu" },
  { key: "TICKET", label: "Event / entry ticket", hint: "Pay to attend a show, festival, or event" },
  { key: "ACTIVITY", label: "Tour / activity", hint: "Guided tour, safari, hike, class, experience" },
  { key: "PACKAGE", label: "Travel package", hint: "Multi-day trip, agent package, stay + activities" },
  { key: "OTHER", label: "Other offer", hint: "Anything else you sell" },
] as const;

export type OfferKind = (typeof OFFER_KINDS)[number]["key"];

export const CATEGORY_LABELS: Record<string, string> = {
  STAY: "Stay (hotel / lodge / BnB)",
  EAT: "Eat & drink",
  MOVE: "Move (transport / transfers)",
  EXPLORE: "Explore (tours, activities, experiences)",
  MEET: "Meet (events, venues, gatherings)",
};

export const LISTING_CATEGORY_KEYS = [
  "STAY",
  "EAT",
  "MOVE",
  "EXPLORE",
  "MEET",
] as const;

export type ListingCategoryKey = (typeof LISTING_CATEGORY_KEYS)[number];

/**
 * What the listing is selling — not only a physical place.
 * Tour guides, travel agents, and event organisers use these too.
 */
export const LISTING_KINDS = [
  {
    key: "PLACE",
    label: "Place / venue",
    hint: "Hotel, restaurant, pool, cinema, venue — guests visit a location",
  },
  {
    key: "EXPERIENCE",
    label: "Experience / tour",
    hint: "Tour guide, safari, hike, class, activity — book an experience",
  },
  {
    key: "EVENT",
    label: "Event / ticket",
    hint: "Concert, workshop, festival, meetup — pay to attend",
  },
  {
    key: "PACKAGE",
    label: "Travel package",
    hint: "Travel agent or operator packages — multi-day or combo deals",
  },
] as const;

export type ListingKindKey = (typeof LISTING_KINDS)[number]["key"];

/** Suggested free-form labels (places, tours, events, packages). */
export const VENUE_TYPE_SUGGESTIONS = [
  "BnB",
  "Hotel",
  "Lodge",
  "Resort",
  "Restaurant",
  "Café",
  "Bar",
  "Pool club",
  "Spa",
  "Cinema",
  "Bowling",
  "Conference venue",
  "Event space",
  "Tour guide",
  "Tour operator",
  "Safari company",
  "Travel agent",
  "Day tour",
  "Multi-day package",
  "Safari package",
  "City experience",
  "Workshop / class",
  "Festival / concert",
  "Private event",
  "Car hire",
  "Airport transfer",
  "Campsite",
];

export function normalizeCategories(input: unknown): ListingCategoryKey[] {
  const allowed = new Set<string>(LISTING_CATEGORY_KEYS);
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];
  const next = Array.from(
    new Set(
      raw
        .map((v) => String(v).trim().toUpperCase())
        .filter((v): v is ListingCategoryKey => allowed.has(v)),
    ),
  );
  return next.length ? next : ["STAY"];
}

export function normalizeListingKinds(input: unknown): ListingKindKey[] {
  const allowed = new Set<string>(LISTING_KINDS.map((k) => k.key));
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];
  const next = Array.from(
    new Set(
      raw
        .map((v) => String(v).trim().toUpperCase())
        .filter((v): v is ListingKindKey => allowed.has(v)),
    ),
  );
  return next.length ? next : ["PLACE"];
}

/** Infer listing kinds from browse categories — avoids asking the same question twice. */
export function kindsFromCategories(
  categories: ListingCategoryKey[],
): ListingKindKey[] {
  const kinds = new Set<ListingKindKey>();
  for (const c of categories) {
    if (c === "EXPLORE") kinds.add("EXPERIENCE");
    else kinds.add("PLACE");
  }
  return kinds.size ? Array.from(kinds) : ["PLACE"];
}

/** Map pin is required only when listing includes a physical place/venue. */
export function requiresMapLocation(kinds: ListingKindKey[]): boolean {
  return kinds.includes("PLACE");
}

/** Suggested default offer kind from listing kinds. */
export function defaultOfferKindFor(kinds: ListingKindKey[]): OfferKind {
  if (kinds.includes("EVENT")) return "TICKET";
  if (kinds.includes("PACKAGE")) return "PACKAGE";
  if (kinds.includes("EXPERIENCE")) return "ACTIVITY";
  return "ROOM";
}

/** Offer types that make sense for the listing’s browse categories. */
export function offerKindsForCategories(
  categories: ListingCategoryKey[],
): OfferKind[] {
  const set = new Set<OfferKind>();
  const cats = categories.length
    ? categories
    : (["STAY"] as ListingCategoryKey[]);
  for (const c of cats) {
    if (c === "STAY") {
      set.add("ROOM");
      set.add("DAY_PASS");
      set.add("PACKAGE");
    }
    if (c === "EAT") {
      set.add("TABLE");
      set.add("DAY_PASS");
    }
    if (c === "MOVE") {
      set.add("ACTIVITY");
      set.add("PACKAGE");
    }
    if (c === "EXPLORE") {
      set.add("ACTIVITY");
      set.add("TICKET");
      set.add("PACKAGE");
      set.add("DAY_PASS");
    }
    if (c === "MEET") {
      set.add("TICKET");
      set.add("PACKAGE");
      set.add("OTHER");
    }
  }
  if (set.size === 0) set.add("OTHER");
  const order = OFFER_KINDS.map((o) => o.key);
  return order.filter((k) => set.has(k));
}

export function defaultOfferKindForCategories(
  categories: ListingCategoryKey[],
): OfferKind {
  const allowed = offerKindsForCategories(categories);
  return allowed[0] || "OTHER";
}

/** Field copy so the add-offer form matches the offer type. */
export function offerFormCopy(kind: OfferKind): {
  nameLabel: string;
  namePlaceholder: string;
  qtyLabel: string;
  qtyHint: string;
  priceLabel: string;
  priceHint: string;
  showDayUse: boolean;
  dayUseLabel: string;
  dayUseHint: string;
  submitLabel: string;
} {
  switch (kind) {
    case "ROOM":
      return {
        nameLabel: "Room name",
        namePlaceholder: "e.g. Deluxe double, Family suite",
        qtyLabel: "Rooms of this type",
        qtyHint: "How many identical rooms you have",
        priceLabel: "Overnight price (KES)",
        priceHint: "Per night",
        showDayUse: true,
        dayUseLabel: "Day-use price (optional)",
        dayUseHint: "Same-day stay without overnight",
        submitLabel: "Add room",
      };
    case "DAY_PASS":
      return {
        nameLabel: "Pass name",
        namePlaceholder: "e.g. Pool day pass, Spa day",
        qtyLabel: "Passes available / day",
        qtyHint: "How many guests can book per day",
        priceLabel: "Price (KES)",
        priceHint: "Per person or per pass",
        showDayUse: false,
        dayUseLabel: "",
        dayUseHint: "",
        submitLabel: "Add day pass",
      };
    case "TABLE":
      return {
        nameLabel: "Table / seating",
        namePlaceholder: "e.g. Indoor table for 4, Rooftop booth",
        qtyLabel: "Tables of this type",
        qtyHint: "How many you can book at once",
        priceLabel: "Booking / deposit (KES)",
        priceHint: "0 if free reservation",
        showDayUse: false,
        dayUseLabel: "",
        dayUseHint: "",
        submitLabel: "Add table",
      };
    case "TICKET":
      return {
        nameLabel: "Ticket name",
        namePlaceholder: "e.g. General admission, VIP seat",
        qtyLabel: "Tickets available",
        qtyHint: "Inventory for this ticket type",
        priceLabel: "Ticket price (KES)",
        priceHint: "Per ticket",
        showDayUse: false,
        dayUseLabel: "",
        dayUseHint: "",
        submitLabel: "Add ticket",
      };
    case "ACTIVITY":
      return {
        nameLabel: "Activity / trip name",
        namePlaceholder: "e.g. City tour, Airport transfer, Safari day",
        qtyLabel: "Seats / vehicles per departure",
        qtyHint: "Default daily capacity — override per date under Departures",
        priceLabel: "Price (KES)",
        priceHint: "Per person or per vehicle",
        showDayUse: false,
        dayUseLabel: "",
        dayUseHint: "",
        submitLabel: "Add activity",
      };
    case "PACKAGE":
      return {
        nameLabel: "Package name",
        namePlaceholder: "e.g. 3-day Masai Mara package",
        qtyLabel: "Seats available",
        qtyHint: "Default capacity per departure date",
        priceLabel: "Package price (KES)",
        priceHint: "Total for the package",
        showDayUse: false,
        dayUseLabel: "",
        dayUseHint: "",
        submitLabel: "Add package",
      };
    default:
      return {
        nameLabel: "Offer name",
        namePlaceholder: "e.g. What guests are booking",
        qtyLabel: "Quantity",
        qtyHint: "How many you can sell",
        priceLabel: "Price (KES)",
        priceHint: "",
        showDayUse: false,
        dayUseLabel: "",
        dayUseHint: "",
        submitLabel: "Add offer",
      };
  }
}

/** Primary category kept for older filters / reports. */
export function primaryCategory(
  categories: ListingCategoryKey[],
): ListingCategoryKey {
  return categories[0] || "STAY";
}

export function normalizeVenueTypes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v) => String(v).trim().replace(/\s+/g, " "))
        .filter((v) => v.length >= 2 && v.length <= 40)
        .slice(0, 12),
    ),
  );
}

export function amenitiesForCategory(category?: string | null): AmenityDef[] {
  return amenitiesForCategories(category ? [category] : null);
}

/** Map provider business type → listing categories for amenity suggestions. */
export function categoriesForBusinessType(
  businessType?: string | null,
): ListingCategoryKey[] {
  switch ((businessType || "").toUpperCase()) {
    case "HOTEL":
    case "GUESTHOUSE":
    case "CAMP":
    case "AIRBNB":
      return ["STAY"];
    case "RESTAURANT":
      return ["EAT"];
    case "TOUR_OPERATOR":
      return ["EXPLORE"];
    case "TRANSFER":
      return ["MOVE"];
    case "EVENT_VENUE":
      return ["MEET"];
    default:
      return [];
  }
}

/** Union of amenities relevant to any of the selected categories. */
export function amenitiesForCategories(
  categories?: string[] | null,
): AmenityDef[] {
  if (!categories?.length) return AMENITIES;
  return AMENITIES.filter((a) => {
    const tags = a.forCategories || ["ALL"];
    if (tags.includes("ALL")) return true;
    return categories.some((c) => tags.includes(c as never));
  });
}

export function amenityLabel(key: string): string {
  return (
    AMENITIES.find((a) => a.key === key)?.label ||
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function offerKindLabel(kind?: string | null): string {
  return OFFER_KINDS.find((k) => k.key === kind)?.label || "Offer";
}

/**
 * Which bookable offer kinds to highlight when a tourist taps an amenity.
 * null = on-site feature only (no filtered offers).
 */
export function offerKindsForAmenity(key: string): OfferKind[] | null {
  const map: Partial<Record<string, OfferKind[]>> = {
    swimming_pool: ["DAY_PASS", "PACKAGE", "ACTIVITY"],
    kids_pool: ["DAY_PASS", "PACKAGE"],
    spa: ["DAY_PASS", "ACTIVITY", "PACKAGE"],
    sauna: ["DAY_PASS", "ACTIVITY"],
    gym: ["DAY_PASS", "ACTIVITY"],
    restaurant: ["TABLE", "PACKAGE"],
    bar: ["TABLE"],
    cafe: ["TABLE"],
    bbq: ["TABLE", "PACKAGE"],
    cinema: ["TICKET", "ACTIVITY"],
    bowling: ["TICKET", "ACTIVITY"],
    arcade: ["TICKET", "ACTIVITY"],
    conference: ["OTHER", "PACKAGE"],
    events_space: ["OTHER", "PACKAGE", "ACTIVITY"],
    live_music: ["TICKET", "TABLE"],
    room_service: ["ROOM", "PACKAGE"],
    laundry: ["ROOM"],
    guided_tours: ["ACTIVITY", "PACKAGE"],
    beach_access: ["DAY_PASS", "ROOM", "PACKAGE"],
    rooftop: ["TABLE", "DAY_PASS", "PACKAGE"],
    garden: ["TABLE", "DAY_PASS"],
  };
  return map[key] ?? null;
}

/**
 * Accepts admin-managed amenity slugs (and legacy hardcoded keys).
 * Free-form labels/names are slugified lightly so they still save.
 */
export function normalizeAmenities(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v) =>
          String(v)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, 40),
        )
        .filter((v) => v.length >= 2),
    ),
  ).slice(0, 40);
}
