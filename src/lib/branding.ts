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
  const name = String(s["general.platformName"] || "Safari Hub");
  const marketName = String(s["general.marketName"] || "Kenya");
  return {
    logoUrl: String(s["branding.logoUrl"] || ""),
    logoText: String(s["branding.logoText"] || "SH"),
    name,
    marketName,
    heroHeadline: String(s["branding.heroHeadline"] || "").trim() || name,
    heroSubheadline: String(s["branding.heroSubheadline"] || "").trim(),
    about: String(s["legal.about"] || "").trim(),
    supportEmail: String(
      s["general.supportEmail"] || "support@safarihub.co.ke",
    ),
    supportPhone: String(s["general.supportPhone"] || ""),
    currency: String(s["general.currency"] || "KES").toUpperCase(),
  };
}
