import { getPlatformSettings } from "@/lib/settings";

export type Brand = {
  logoUrl: string;
  logoText: string;
  name: string;
  marketName: string;
  heroHeadline: string;
  heroSubheadline: string;
  about: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  accentColor: string;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  googleMapsApiKey: string;
};

/** Public marketplace name from Admin → Settings → General. */
export async function getPlatformName(): Promise<string> {
  const s = await getPlatformSettings();
  return String(s["general.platformName"] || "").trim() || "Platform";
}

/** Resolve the current brand (logo + name) from platform settings. */
export async function brandFromSettings(): Promise<Brand> {
  const s = await getPlatformSettings();
  const name = String(s["general.platformName"] || "").trim() || "Platform";
  const marketName = String(s["general.marketName"] || "").trim();
  const initials =
    String(s["branding.logoText"] || "").trim() ||
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") ||
    "·";
  const accent = String(s["branding.accentColor"] || "").trim() || "#d4a017";
  return {
    logoUrl: String(s["branding.logoUrl"] || ""),
    logoText: initials,
    name,
    marketName,
    heroHeadline: String(s["branding.heroHeadline"] || "").trim() || name,
    heroSubheadline: String(s["branding.heroSubheadline"] || "").trim(),
    about: String(s["legal.about"] || "").trim(),
    supportEmail: String(s["general.supportEmail"] || "").trim(),
    supportPhone: String(s["general.supportPhone"] || "").trim(),
    currency: String(s["general.currency"] || "KES").toUpperCase(),
    accentColor: accent,
    checkInTime: String(s["booking.checkInTime"] || "14:00"),
    checkOutTime: String(s["booking.checkOutTime"] || "10:00"),
    timezone: String(s["general.timezone"] || "Africa/Nairobi"),
    googleMapsApiKey: String(s["integrations.googleMapsApiKey"] || "").trim(),
  };
}
