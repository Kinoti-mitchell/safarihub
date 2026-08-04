export type Locale = "en" | "sw";

const STRINGS = {
  en: {
    browse: "Browse",
    destinations: "Destinations",
    packages: "Packages",
    events: "Events",
    myTrips: "My trips",
    tripBuilder: "Your trip",
    support: "Support",
    cancelPolicy: "Cancellation policy",
    freeCancel: "Free cancel before check-in",
    manageBooking: "Manage booking",
    addToCalendar: "Add to calendar",
    printVoucher: "Print voucher",
    safety: "Travel safety",
    weather: "Weather & season",
    approxFx: "Approx.",
    bookNow: "Book now",
    fromPrice: "From",
    guests: "Guests",
    checkIn: "Check-in",
    checkOut: "Check-out",
    search: "Search",
    login: "Log in",
    join: "Join",
    askQuestion: "Ask a question",
    addToTrip: "Add to trip",
    shareWhatsApp: "Share on WhatsApp",
    ticketsNearby: "Get tickets / book nearby",

    // Landing
    findAPlace: "Find a place",
    where: "Where",
    wherePlaceholder: "Lodge, town, vibe…",
    county: "County",
    anywhere: "Anywhere",
    anywhereIn: "Anywhere in {market}",
    type: "Type",
    all: "All",
    oneTripEveryPiece: "One trip. Every piece.",
    oneTripBlurb:
      "Stays and tours first — the same marketplace operators use to run hospitality {market}.",
    acrossMarket: "across {market}",
    inOneMarketplace: "in one marketplace",
    defaultHeroSub:
      "Stay, eat, move, explore and meet — hospitality {market}.",
    planYourTrip: "Plan your trip",
    allDestinations: "All destinations →",
    curated: "Curated",
    featuredAcross: "Featured across {market}",
    featuredOn: "Featured on {name}",
    featuredBlurb:
      "Hand-picked stays, dining, transport and experiences — not limited to one category.",
    browseAll: "Browse all →",
    browseAllShort: "Browse all",
    payYourWay: "Pay your way",
    verifiedOperators: "Verified operators",
    reviewedBeforeLive: "Reviewed before going live",
    pwaLabel: "PWA",
    worksWithoutAppStore: "Works without an app store",
    howItWorks: "How it works",
    stepDiscover: "Discover",
    stepDiscoverBody: "Browse verified stays and experiences by destination.",
    stepBookPay: "Book & pay",
    stepBookPayBody: "Reserve instantly or on request",
    stepBookPayPayWith: ". Pay with {methods}.",
    stepEnjoy: "Enjoy {market}",
    stepEnjoyTrip: "Enjoy your trip",
    stepEnjoyBody: "Turn up and enjoy — loyalty points on every trip.",
    forOperators: "For operators",
    runBusinessOn: "Run your hospitality business on {name}",
    operatorsBlurb:
      "Listings, bookings, inbox and payouts — tools for hotels, venues, tours and transfers, not just a storefront.",
    becomeProvider: "Become a provider",
    cashOnArrival: "Cash on arrival",
    card: "Card",

    // Categories
    catStays: "Stays",
    catStaysBlurb: "Lodges, hotels and guesthouses for every kind of trip.",
    catEat: "Eat & go out",
    catEatBlurb: "Restaurants, cafés and nightlife worth planning a night around.",
    catMove: "Move",
    catMoveBlurb: "Airport transfers, car hire and rides between destinations.",
    catExplore: "Explore",
    catExploreBlurb: "Guided tours, activities and memorable days out.",
    catMeet: "Meet",
    catMeetBlurb: "Venues and spaces for events, meetings and special moments.",
    toursExperiences: "Tours & experiences",

    // Footer
    discover: "Discover",
    travellers: "Travellers",
    company: "Company",
    cancellation: "Cancellation",
    emergencyKe: "Emergency KE: 999 / 112",
    about: "About",
    terms: "Terms",
    privacy: "Privacy",
    builtFor: "Built for {market}'s hospitality economy",
    defaultAbout:
      "{name} is a digital hospitality ecosystem — connecting travellers with operators for stays, dining, transport, events and experiences.",
  },
  sw: {
    browse: "Vinjari",
    destinations: "Maeneo",
    packages: "Vifurushi",
    events: "Matukio",
    myTrips: "Safari zangu",
    tripBuilder: "Safari yako",
    support: "Msaada",
    cancelPolicy: "Sera ya kughairi",
    freeCancel: "Ghairi bure kabla ya kuingia",
    manageBooking: "Simamia nafasi",
    addToCalendar: "Ongeza kwenye kalenda",
    printVoucher: "Chapisha vocha",
    safety: "Usalama wa safari",
    weather: "Hali ya hewa na msimu",
    approxFx: "Takriban",
    bookNow: "Booki sasa",
    fromPrice: "Kuanzia",
    guests: "Wageni",
    checkIn: "Kuwasili",
    checkOut: "Kuondoka",
    search: "Tafuta",
    login: "Ingia",
    join: "Jiunge",
    askQuestion: "Uliza swali",
    addToTrip: "Ongeza kwenye safari",
    shareWhatsApp: "Shiriki WhatsApp",
    ticketsNearby: "Tiketi / booki karibu",

    findAPlace: "Tafuta mahali",
    where: "Wapi",
    wherePlaceholder: "Lodi, mji, hali…",
    county: "Kaunti",
    anywhere: "Popote",
    anywhereIn: "Popote {market}",
    type: "Aina",
    all: "Zote",
    oneTripEveryPiece: "Safari moja. Kila sehemu.",
    oneTripBlurb:
      "Malazi na ziara kwanza — soko lile lile wanaotumia waendeshaji kuendesha biashara {market}.",
    acrossMarket: "katika {market}",
    inOneMarketplace: "kwa soko moja",
    defaultHeroSub:
      "Lala, kula, tembea, chunguza na kutana — ukarimu {market}.",
    planYourTrip: "Panga safari yako",
    allDestinations: "Maeneo yote →",
    curated: "Teuliwa",
    featuredAcross: "Maarufu katika {market}",
    featuredOn: "Maarufu kwenye {name}",
    featuredBlurb:
      "Malazi, vyakula, usafiri na uzoefu vilivyochaguliwa — si kwa kategoria moja pekee.",
    browseAll: "Vinjari zote →",
    browseAllShort: "Vinjari zote",
    payYourWay: "Lipa kwa njia yako",
    verifiedOperators: "Waendeshaji walioidhinishwa",
    reviewedBeforeLive: "Hukaguliwa kabla ya kuchapishwa",
    pwaLabel: "PWA",
    worksWithoutAppStore: "Inafanya kazi bila duka la programu",
    howItWorks: "Jinsi inavyofanya kazi",
    stepDiscover: "Gundua",
    stepDiscoverBody: "Vinjari malazi na uzoefu ulioidhinishwa kwa eneo.",
    stepBookPay: "Booki na lipa",
    stepBookPayBody: "Hifadhi papo hapo au kwa ombi",
    stepBookPayPayWith: ". Lipa kwa {methods}.",
    stepEnjoy: "Furahia {market}",
    stepEnjoyTrip: "Furahia safari yako",
    stepEnjoyBody: "Fika na furahia — pointi za uaminifu kila safari.",
    forOperators: "Kwa waendeshaji",
    runBusinessOn: "Endesha biashara yako ya ukarimu kwenye {name}",
    operatorsBlurb:
      "Orodha, booki, ujumbe na malipo — zana kwa hoteli, viwanja, ziara na usafiri, si duka tu.",
    becomeProvider: "Kuwa mtoa huduma",
    cashOnArrival: "Pesa taslimu unapofika",
    card: "Kadi",

    catStays: "Malazi",
    catStaysBlurb: "Lodi, hoteli na nyumba za wageni kwa kila aina ya safari.",
    catEat: "Kula na kutoka nje",
    catEatBlurb: "Migahawa, mikahawa na burudani za usiku zinazostahili mpango.",
    catMove: "Usafiri",
    catMoveBlurb: "Uhamisho wa uwanja wa ndege, kukodisha gari na safari kati ya maeneo.",
    catExplore: "Chunguza",
    catExploreBlurb: "Ziara za kuongozwa, shughuli na siku za kukumbukwa.",
    catMeet: "Kutana",
    catMeetBlurb: "Viwanja na nafasi kwa matukio, mikutano na sherehe.",
    toursExperiences: "Ziara na uzoefu",

    discover: "Gundua",
    travellers: "Wasafiri",
    company: "Kampuni",
    cancellation: "Kughairi",
    emergencyKe: "Dharura KE: 999 / 112",
    about: "Kuhusu",
    terms: "Masharti",
    privacy: "Faragha",
    builtFor: "Imejengwa kwa uchumi wa ukarimu wa {market}",
    defaultAbout:
      "{name} ni mfumo wa kidijitali wa ukarimu — unaounganisha wasafiri na waendeshaji kwa malazi, vyakula, usafiri, matukio na uzoefu.",
  },
} as const;

export type I18nKey = keyof (typeof STRINGS)["en"];

export function t(
  locale: Locale,
  key: I18nKey,
  vars?: Record<string, string>,
): string {
  let out: string = STRINGS[locale][key] || STRINGS.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(v);
    }
  }
  return out;
}

export function parseLocale(value: string | undefined | null): Locale {
  return value === "sw" ? "sw" : "en";
}

const CAT_LABEL: Record<string, I18nKey> = {
  stays: "catStays",
  eat: "catEat",
  move: "catMove",
  explore: "catExplore",
  meet: "catMeet",
};

const CAT_BLURB: Record<string, I18nKey> = {
  stays: "catStaysBlurb",
  eat: "catEatBlurb",
  move: "catMoveBlurb",
  explore: "catExploreBlurb",
  meet: "catMeetBlurb",
};

export function categoryLabelI18n(locale: Locale, slug: string): string {
  const key = CAT_LABEL[slug];
  return key ? t(locale, key) : slug;
}

export function categoryBlurbI18n(locale: Locale, slug: string): string {
  const key = CAT_BLURB[slug];
  return key ? t(locale, key) : "";
}
