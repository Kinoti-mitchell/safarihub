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
};

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
  };
}
