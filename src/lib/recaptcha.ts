import { getPlatformSettings } from "@/lib/settings";

/**
 * Verify a reCAPTCHA v2/v3 token when Admin has configured a secret.
 * If no secret is set, verification is skipped (returns ok).
 */
export async function verifyRecaptcha(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const settings = await getPlatformSettings();
  const secret = String(settings["integrations.recaptchaSecret"] || "").trim();
  if (!secret) return { ok: true, skipped: true };

  const response = String(token || "").trim();
  if (!response) {
    return { ok: false, skipped: false, error: "Complete the captcha challenge" };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response,
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      return {
        ok: false,
        skipped: false,
        error: "Captcha verification failed",
      };
    }
    return { ok: true, skipped: false };
  } catch {
    return { ok: false, skipped: false, error: "Captcha verification unavailable" };
  }
}
