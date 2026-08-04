export const CATEGORIES = [
  {
    slug: "stays",
    category: "STAY",
    label: "Stays",
    eyebrow: "A place to rest",
    blurb: "Lodges, hotels and guesthouses for every kind of trip.",
    image: "/hero/elephants-savanna.jpg",
    launchCore: true,
  },
  {
    slug: "eat",
    category: "EAT",
    label: "Eat & go out",
    eyebrow: "Taste the journey",
    blurb: "Restaurants, cafés and nightlife worth planning a night around.",
    image: "/hero/elephant-close.jpg",
    launchCore: false,
  },
  {
    slug: "move",
    category: "MOVE",
    label: "Move",
    eyebrow: "Get there smoothly",
    blurb: "Airport transfers, car hire and rides between destinations.",
    image: "/hero/elephant-herd.jpg",
    launchCore: false,
  },
  {
    slug: "explore",
    category: "EXPLORE",
    label: "Explore",
    eyebrow: "Experiences & days out",
    blurb: "Guided tours, activities and memorable days out.",
    image: "/hero/elephants-savanna.jpg",
    launchCore: true,
  },
  {
    slug: "meet",
    category: "MEET",
    label: "Meet",
    eyebrow: "Gather & celebrate",
    blurb: "Venues and spaces for events, meetings and special moments.",
    image: "/hero/elephant-herd.jpg",
    launchCore: false,
  },
] as const;

/** Categories visible on public surfaces given platform flags. */
export function publicCategories(settings: Record<string, unknown>) {
  const launchFocus = settings["flags.launchFocusStayTours"];
  // Default ON when unset (launch Stay + Explore/tours).
  const focusOn =
    launchFocus === true ||
    launchFocus === "true" ||
    launchFocus === undefined ||
    launchFocus === null ||
    launchFocus === "";
  // Explicit false turns focus off → show all categories.
  if (launchFocus === false || launchFocus === "false") {
    return [...CATEGORIES];
  }
  if (!focusOn) return [...CATEGORIES];

  const extras: Record<string, string> = {
    EAT: "flags.catalogEatEnabled",
    MOVE: "flags.catalogMoveEnabled",
    MEET: "flags.catalogMeetEnabled",
  };
  return CATEGORIES.filter((c) => {
    if (c.launchCore) return true;
    const key = extras[c.category];
    if (!key) return false;
    const v = settings[key];
    return v === true || v === "true";
  });
}

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export type CategoryEnum = (typeof CATEGORIES)[number]["category"];

export function resolveCategoryEnum(
  raw?: string | null,
): CategoryEnum | undefined {
  if (!raw) return undefined;
  const key = raw.trim();
  const found = CATEGORIES.find(
    (c) =>
      c.slug === key.toLowerCase() || c.category === key.toUpperCase(),
  );
  return found?.category;
}

export function browseHref(params: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

export function categoryLabel(c: string) {
  if (c === "STAY") return "Stay";
  if (c === "EAT") return "Eat";
  if (c === "MOVE") return "Move";
  if (c === "EXPLORE") return "Explore";
  if (c === "MEET") return "Meet";
  return c;
}
