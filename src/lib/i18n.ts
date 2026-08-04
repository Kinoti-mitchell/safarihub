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
  },
} as const;

export type I18nKey = keyof (typeof STRINGS)["en"];

export function t(locale: Locale, key: I18nKey): string {
  return STRINGS[locale][key] || STRINGS.en[key];
}

export function parseLocale(value: string | undefined | null): Locale {
  return value === "sw" ? "sw" : "en";
}
