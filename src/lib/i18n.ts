export type Locale = "en" | "sw";

const STRINGS = {
  en: {
    browse: "Browse",
    destinations: "Destinations",
    packages: "Packages",
    events: "Events",
    support: "Support",
    cancelPolicy: "Cancellation policy",
    freeCancel: "Free cancel before check-in",
    manageBooking: "Manage booking",
    addToCalendar: "Add to calendar",
    printVoucher: "Print voucher",
    safety: "Travel safety",
    weather: "Weather & season",
    approxFx: "Approx.",
  },
  sw: {
    browse: "Vinjari",
    destinations: "Maeneo",
    packages: "Vifurushi",
    events: "Matukio",
    support: "Msaada",
    cancelPolicy: "Sera ya kughairi",
    freeCancel: "Ghairi bure kabla ya kuingia",
    manageBooking: "Simamia nafasi",
    addToCalendar: "Ongeza kwenye kalenda",
    printVoucher: "Chapisha vocha",
    safety: "Usalama wa safari",
    weather: "Hali ya hewa na msimu",
    approxFx: "Takriban",
  },
} as const;

export type I18nKey = keyof (typeof STRINGS)["en"];

export function t(locale: Locale, key: I18nKey): string {
  return STRINGS[locale][key] || STRINGS.en[key];
}

export function parseLocale(value: string | undefined | null): Locale {
  return value === "sw" ? "sw" : "en";
}
