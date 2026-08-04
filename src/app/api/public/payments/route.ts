import { handleRouteError, jsonOk } from "@/lib/http";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

/**
 * Public payment capability flags (no secrets).
 * Used by listing/package checkout UIs for honest card/M-Pesa labels.
 */
export async function GET() {
  try {
    const settings = await getPlatformSettings();
    const cardMode = String(settings["payments.cardMode"] || "sandbox");
    return jsonOk({
      mpesaEnabled: boolSetting(settings, "payments.mpesaEnabled"),
      cardEnabled: boolSetting(settings, "payments.cardEnabled"),
      cardMode:
        cardMode === "manual" || cardMode === "sandbox" ? cardMode : "sandbox",
      cashEnabled: boolSetting(settings, "payments.cashEnabled"),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
