import { getPlatformSettings } from "@/lib/settings";

const FALLBACK_TZ = "Africa/Nairobi";

/** Platform timezone from Admin → Settings → General. */
export async function getPlatformTimezone(): Promise<string> {
  const settings = await getPlatformSettings();
  const tz = String(settings["general.timezone"] || "").trim();
  return tz || FALLBACK_TZ;
}

export function formatDateInTz(
  value: string | Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-KE", {
    timeZone: timeZone || FALLBACK_TZ,
    ...options,
  });
}

export function formatDateTimeInTz(
  value: string | Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-KE", {
    timeZone: timeZone || FALLBACK_TZ,
    ...options,
  });
}
