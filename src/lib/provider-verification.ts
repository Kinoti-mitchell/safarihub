import { z } from "zod";

/** Hospitality business types collected at provider signup. */
export const BUSINESS_TYPES = [
  { value: "HOTEL", label: "Hotel / lodge" },
  { value: "GUESTHOUSE", label: "Guesthouse / B&B" },
  { value: "CAMP", label: "Camp / tented camp" },
  { value: "AIRBNB", label: "Airbnb / apartment" },
  { value: "RESTAURANT", label: "Restaurant / café" },
  { value: "TOUR_OPERATOR", label: "Tour operator / safari" },
  { value: "TRANSFER", label: "Transfers / car hire" },
  { value: "EVENT_VENUE", label: "Event / conference venue" },
  { value: "OTHER", label: "Other hospitality" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export const OPERATING_DAY_OPTIONS = [
  { value: "Mon-Sun", label: "Every day (Mon–Sun)" },
  { value: "Mon-Fri", label: "Weekdays (Mon–Fri)" },
  { value: "Mon-Sat", label: "Mon–Sat" },
  { value: "Fri-Sun", label: "Weekends (Fri–Sun)" },
  { value: "Custom", label: "Custom / seasonal" },
] as const;

export const DIRECTOR_ROLES = [
  "Director",
  "Managing Director",
  "Shareholder",
  "Partner",
  "Secretary",
  "Other",
] as const;

/** Role of the person filling the registration form (shown to admin). */
export const REGISTRANT_ROLES = [
  {
    value: "OWNER",
    label: "Owner / proprietor",
    hint: "You own or personally run this business",
  },
  {
    value: "DIRECTOR",
    label: "Company director",
    hint: "Registered director of the company",
  },
  {
    value: "MANAGER",
    label: "General / operations manager",
    hint: "Day-to-day operations lead",
  },
  {
    value: "ICT",
    label: "ICT / systems",
    hint: "Setting up systems or online booking",
  },
  {
    value: "FRONT_DESK",
    label: "Front desk / reservations",
    hint: "Guest bookings and check-in",
  },
  {
    value: "ACCOUNTANT",
    label: "Accountant / finance",
    hint: "Payments, KRA, and payouts",
  },
  {
    value: "MARKETING",
    label: "Marketing / sales",
    hint: "Listings, offers, and promotions",
  },
  {
    value: "AGENT",
    label: "Authorized agent",
    hint: "Registering on behalf of the owner",
  },
  {
    value: "OTHER",
    label: "Other staff",
    hint: "Another role at this business",
  },
] as const;

export type RegistrantRole = (typeof REGISTRANT_ROLES)[number]["value"];

export function registrantRoleLabel(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return (
    REGISTRANT_ROLES.find((r) => r.value === value)?.label ??
    value.replace(/_/g, " ").toLowerCase()
  );
}

export type CompanyDirector = {
  name: string;
  idNumber?: string | null;
  role?: string | null;
};

const directorSchema = z.object({
  name: z.string().min(2).max(120),
  idNumber: z.string().max(40).optional().nullable(),
  role: z.string().max(60).optional().nullable(),
});

/** Kenyan KRA PIN: letter + 9 digits + letter, e.g. A123456789Z */
export function normalizeKraPin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  return cleaned || null;
}

export function isValidKraPin(pin: string): boolean {
  return /^[A-Z]\d{9}[A-Z]$/.test(pin);
}

/** Accept https://… or bare domain; store absolute URL. */
export function normalizeWebsite(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".")) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function parseDirectorsJson(
  raw: unknown,
): CompanyDirector[] {
  if (raw == null || raw === "") return [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: CompanyDirector[] = [];
  for (const item of value) {
    const parsed = directorSchema.safeParse(item);
    if (!parsed.success) continue;
    out.push({
      name: parsed.data.name.trim(),
      idNumber: parsed.data.idNumber?.trim() || null,
      role: parsed.data.role?.trim() || null,
    });
  }
  return out.slice(0, 20);
}

export function parseOtherDocsUrls(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      if (raw.startsWith("http") || raw.startsWith("/")) return [raw];
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map((u) => u.trim())
    .slice(0, 10);
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/** Normalize browser time values (sometimes HH:MM:SS) to HH:MM. */
export function normalizeTimeHm(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/**
 * Shared provider-verification fields (register + add-business).
 * Used when role is PROVIDER / creating a business.
 */
export const providerVerificationFields = {
  companyEmail: z.string().email().optional(),
  kraPin: z.string().min(8).max(20).optional(),
  postalAddress: z.string().min(5).max(300).optional(),
  countyId: z.string().min(1).optional(),
  townId: z.string().min(1).optional(),
  businessType: z
    .enum([
      "HOTEL",
      "GUESTHOUSE",
      "CAMP",
      "AIRBNB",
      "RESTAURANT",
      "TOUR_OPERATOR",
      "TRANSFER",
      "EVENT_VENUE",
      "OTHER",
    ])
    .optional(),
  operatingDays: z.string().min(2).max(80).optional(),
  opensAt: z.string().regex(timeRe, "Use HH:MM (24h)").optional(),
  closesAt: z.string().regex(timeRe, "Use HH:MM (24h)").optional(),
  establishedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  registrantRole: z
    .enum([
      "OWNER",
      "DIRECTOR",
      "MANAGER",
      "ICT",
      "FRONT_DESK",
      "ACCOUNTANT",
      "MARKETING",
      "AGENT",
      "OTHER",
    ])
    .optional(),
  directors: z.union([z.string(), z.array(directorSchema)]).optional(),
  otherDocsUrls: z.union([z.string(), z.array(z.string())]).optional(),
  ownerIdDocUrl: z.string().min(1).max(2000).optional().nullable(),
  kraPinDocUrl: z.string().min(1).max(2000).optional().nullable(),
  registrationCertUrl: z.string().min(1).max(2000).optional().nullable(),
  businessPermitUrl: z.string().min(1).max(2000).optional().nullable(),
  kycDocUrl: z.string().min(1).max(2000).optional().nullable(),
  selfieDocUrl: z.string().min(1).max(2000).optional().nullable(),
  mpesaTillOrPaybill: z.string().min(5).max(40).optional().nullable(),
  businessPermitExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  traLicenceExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
  phoneOtpId: z.string().optional().nullable(),
  emailOtpId: z.string().optional().nullable(),
};

export function refineProviderVerification(
  data: {
    kycType?: string | null;
    kraPin?: string | null;
    companyEmail?: string | null;
    postalAddress?: string | null;
    countyId?: string | null;
    townId?: string | null;
    businessType?: string | null;
    operatingDays?: string | null;
    opensAt?: string | null;
    closesAt?: string | null;
    establishedDate?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    website?: string | null;
    registrantRole?: string | null;
    ownerIdDocUrl?: string | null;
    kraPinDocUrl?: string | null;
    registrationCertUrl?: string | null;
    businessPermitUrl?: string | null;
    kycDocUrl?: string | null;
    selfieDocUrl?: string | null;
    mpesaTillOrPaybill?: string | null;
    businessPermitExpiresAt?: string | null;
    termsAccepted?: boolean | null;
    privacyAccepted?: boolean | null;
  },
  ctx: z.RefinementCtx,
  opts: { requireDocs?: boolean } = {},
) {
  const requireDocs = opts.requireDocs !== false;

  if (!data.registrantRole?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registrantRole"],
      message: "Say who you are at the business (owner, manager, ICT, etc.)",
    });
  }
  if (!data.companyEmail?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["companyEmail"],
      message: "Company email is required",
    });
  }
  const kra = normalizeKraPin(data.kraPin);
  if (!kra || !isValidKraPin(kra)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kraPin"],
      message: "Enter a valid KRA PIN (e.g. A123456789Z)",
    });
  }
  if (!data.postalAddress?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["postalAddress"],
      message: "Postal / physical address is required",
    });
  }
  if (!data.countyId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["countyId"],
      message: "County is required",
    });
  }
  if (!data.townId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["townId"],
      message: "Town is required",
    });
  }
  if (!data.businessType?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businessType"],
      message: "Business type is required",
    });
  }
  if (!data.operatingDays?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["operatingDays"],
      message: "Operating days are required",
    });
  }
  if (!data.opensAt?.trim() || !data.closesAt?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["opensAt"],
      message: "Opening and closing times are required",
    });
  }
  if (!data.establishedDate?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["establishedDate"],
      message: "Date business started operating is required",
    });
  }
  if (
    data.latitude == null ||
    data.longitude == null ||
    Number.isNaN(data.latitude) ||
    Number.isNaN(data.longitude)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["latitude"],
      message: "Set business geolocation (use GPS or pick a town)",
    });
  }
  if (data.website?.trim()) {
    const site = normalizeWebsite(data.website);
    if (!site) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["website"],
        message: "Enter a valid website (e.g. https://yourlodge.co.ke)",
      });
    }
  }
  if (requireDocs && !data.ownerIdDocUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ownerIdDocUrl"],
      message: "Upload a photo/scan of the owner's national ID",
    });
  }
  if (requireDocs && !data.kraPinDocUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kraPinDocUrl"],
      message: "Upload the KRA PIN document",
    });
  }
  const isCompany = (data.kycType || "INDIVIDUAL").toUpperCase() === "COMPANY";
  if (requireDocs && isCompany && !data.registrationCertUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registrationCertUrl"],
      message: "Upload the certificate of incorporation",
    });
  }
  if (requireDocs && !data.businessPermitUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businessPermitUrl"],
      message: "Upload the business permit / tourism licence",
    });
  }
  if (requireDocs && isCompany && !data.kycDocUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kycDocUrl"],
      message: "Upload a CR12 or supporting verification document",
    });
  }
  if (requireDocs && !data.selfieDocUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selfieDocUrl"],
      message: "Upload a selfie holding your national ID",
    });
  }
  if (!data.businessPermitExpiresAt?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businessPermitExpiresAt"],
      message: "Enter the business permit / TRA licence expiry date",
    });
  }
  if (!data.termsAccepted || !data.privacyAccepted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["termsAccepted"],
      message: "Accept the Terms of Service and Privacy Policy",
    });
  }
}

export function verificationInsertFromParsed(data: {
  companyEmail?: string | null;
  kraPin?: string | null;
  postalAddress?: string | null;
  countyId?: string | null;
  townId?: string | null;
  businessType?: string | null;
  operatingDays?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  establishedDate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  registrantRole?: string | null;
  directors?: unknown;
  otherDocsUrls?: unknown;
  ownerIdDocUrl?: string | null;
  kraPinDocUrl?: string | null;
  registrationCertUrl?: string | null;
  businessPermitUrl?: string | null;
  kycDocUrl?: string | null;
  selfieDocUrl?: string | null;
  mpesaTillOrPaybill?: string | null;
  businessPermitExpiresAt?: string | null;
  traLicenceExpiresAt?: string | null;
  termsAccepted?: boolean | null;
  privacyAccepted?: boolean | null;
  amenities?: unknown;
}) {
  const now = new Date().toISOString();
  const amenities = Array.isArray(data.amenities)
    ? Array.from(
        new Set(
          data.amenities
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
      ).slice(0, 40)
    : [];
  return {
    companyEmail: data.companyEmail?.trim().toLowerCase() || null,
    kraPin: normalizeKraPin(data.kraPin),
    postalAddress: data.postalAddress?.trim() || null,
    countyId: data.countyId?.trim() || null,
    townId: data.townId?.trim() || null,
    businessType: data.businessType?.trim() || null,
    amenities,
    operatingDays: data.operatingDays?.trim() || null,
  opensAt: data.opensAt?.trim() ? normalizeTimeHm(data.opensAt) : null,
  closesAt: data.closesAt?.trim() ? normalizeTimeHm(data.closesAt) : null,
    establishedDate: data.establishedDate?.trim() || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    website: normalizeWebsite(data.website),
    registrantRole: data.registrantRole?.trim() || null,
    directors: parseDirectorsJson(data.directors),
    otherDocsUrls: parseOtherDocsUrls(data.otherDocsUrls),
    ownerIdDocUrl: data.ownerIdDocUrl?.trim() || null,
    kraPinDocUrl: data.kraPinDocUrl?.trim() || null,
    registrationCertUrl: data.registrationCertUrl?.trim() || null,
    businessPermitUrl: data.businessPermitUrl?.trim() || null,
    kycDocUrl: data.kycDocUrl?.trim() || null,
    selfieDocUrl: data.selfieDocUrl?.trim() || null,
    mpesaTillOrPaybill: data.mpesaTillOrPaybill?.trim() || null,
    businessPermitExpiresAt: data.businessPermitExpiresAt?.trim() || null,
    traLicenceExpiresAt: data.traLicenceExpiresAt?.trim() || null,
    termsAcceptedAt: data.termsAccepted ? now : null,
    privacyAcceptedAt: data.privacyAccepted ? now : null,
    termsVersion: data.termsAccepted ? "2026-07" : null,
  };
}

export function businessTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    BUSINESS_TYPES.find((t) => t.value === value)?.label ??
    value.replace(/_/g, " ").toLowerCase()
  );
}
