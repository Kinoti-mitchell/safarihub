import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  SETTINGS_GROUPS,
  getPlatformSettings,
  savePlatformSettings,
  isSecretField,
} from "@/lib/settings";


export async function GET() {
  try {
    await requireAdminPermission("settings.manage");
    const values = await getPlatformSettings();

    // Never send raw secrets to the browser — mask them and expose only
    // whether a value is configured, so the UI can show a "saved" hint.
    const masked: Record<string, unknown> = { ...values };
    const secretsSet: Record<string, boolean> = {};
    for (const key of Object.keys(values)) {
      if (isSecretField(key)) {
        secretsSet[key] = Boolean(values[key]);
        masked[key] = "";
      }
    }

    return jsonOk({ groups: SETTINGS_GROUPS, values: masked, secretsSet });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminPermission("settings.manage");
    const body = await request.json().catch(() => ({}));
    const patch =
      body && typeof body === "object" && body.values ? body.values : body;
    if (!patch || typeof patch !== "object") {
      return jsonError("Invalid settings payload", 400);
    }
    const changed = await savePlatformSettings(patch as Record<string, unknown>);
    if (changed.length) {
      await logAudit({
        actor: admin,
        action: "settings.update",
        entityType: "Setting",
        summary: `Updated ${changed.length} setting${changed.length === 1 ? "" : "s"}`,
        metadata: { keys: changed },
      });
    }
    const values = await getPlatformSettings();
    const masked: Record<string, unknown> = { ...values };
    const secretsSet: Record<string, boolean> = {};
    for (const key of Object.keys(values)) {
      if (isSecretField(key)) {
        secretsSet[key] = Boolean(values[key]);
        masked[key] = "";
      }
    }
    return jsonOk({ values: masked, secretsSet, changed });
  } catch (error) {
    return handleRouteError(error);
  }
}
