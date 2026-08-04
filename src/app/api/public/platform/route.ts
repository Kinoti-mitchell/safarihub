import { handleRouteError, jsonOk } from "@/lib/http";
import {
  boolSetting,
  getPlatformSettings,
  numberSetting,
} from "@/lib/settings";

/**
 * Public, non-secret platform flags for client forms (signup, login, chrome).
 */
export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return jsonOk({
      platformName: String(settings["general.platformName"] || "Safari Hub"),
      currency: String(settings["general.currency"] || "KES"),
      timezone: String(settings["general.timezone"] || "Africa/Nairobi"),
      maintenanceMode: boolSetting(settings, "general.maintenanceMode"),
      allowSelfSignup: boolSetting(settings, "security.allowSelfSignup"),
      minPasswordLength:
        numberSetting(settings, "security.minPasswordLength") || 6,
      bindSessionToTab: boolSetting(settings, "security.bindSessionToTab"),
      sessionMinutes: numberSetting(settings, "security.sessionMinutes") || 60,
      checkInTime: String(settings["booking.checkInTime"] || "14:00"),
      checkOutTime: String(settings["booking.checkOutTime"] || "10:00"),
      accentColor: String(settings["branding.accentColor"] || "#d4a017"),
      recaptchaSiteKey: String(
        settings["integrations.recaptchaSiteKey"] || "",
      ).trim(),
      googleMapsApiKey: String(
        settings["integrations.googleMapsApiKey"] || "",
      ).trim()
        ? "configured"
        : "",
      suppliersEnabled: boolSetting(settings, "flags.suppliersEnabled"),
      staffingEnabled: boolSetting(settings, "flags.staffingEnabled"),
      eventsEnabled: boolSetting(settings, "flags.eventsEnabled"),
      packagesEnabled: boolSetting(settings, "flags.packagesEnabled"),
      reviewsEnabled: boolSetting(settings, "flags.reviewsEnabled"),
      inquiriesEnabled: boolSetting(settings, "flags.inquiriesEnabled"),
      loyaltyEnabled: boolSetting(settings, "flags.loyaltyEnabled"),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
