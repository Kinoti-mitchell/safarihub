import { getPlatformSettings, type SettingValue } from "@/lib/settings";
import { normalizePhone as normalizeKenyanPhone } from "@/lib/identity";

function str(settings: Record<string, SettingValue>, key: string): string {
  const v = settings[key];
  return v == null ? "" : String(v);
}

/** Normalise a Kenyan phone number to the 2547XXXXXXXX form Daraja/AT expect. */
export function normalizePhone(input?: string | null): string | null {
  return normalizeKenyanPhone(input);
}

/**
 * Send an SMS using the provider configured in Admin → Settings → SMS.
 * Supports Africa's Talking, Twilio, and a generic custom HTTP endpoint.
 * Never throws; degrades to a logged no-op when disabled or unconfigured.
 */
export async function sendSms(
  to: string,
  message: string,
): Promise<boolean> {
  try {
    const settings = await getPlatformSettings();
    if (!settings["sms.enabled"]) return logFallback(to, message, "disabled");
    const phone = normalizePhone(to);
    if (!phone) return false;

    const provider = str(settings, "sms.provider") || "africastalking";
    const apiKey = str(settings, "sms.apiKey");
    const username = str(settings, "sms.username");
    const senderId = str(settings, "sms.senderId");

    if (provider === "africastalking") {
      if (!apiKey || !username) return logFallback(to, message, "at: no creds");
      const body = new URLSearchParams({
        username,
        to: `+${phone}`,
        message,
      });
      if (senderId) body.set("from", senderId);
      const res = await fetch(
        "https://api.africastalking.com/version1/messaging",
        {
          method: "POST",
          headers: {
            apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body,
        },
      );
      return res.ok || logFallback(to, message, `at ${res.status}`);
    }

    if (provider === "twilio") {
      if (!apiKey || !username) return logFallback(to, message, "twilio: no creds");
      const body = new URLSearchParams({
        To: `+${phone}`,
        From: senderId,
        Body: message,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${username}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      return res.ok || logFallback(to, message, `twilio ${res.status}`);
    }

    if (provider === "custom") {
      const endpoint = str(settings, "sms.endpoint");
      if (!endpoint) return logFallback(to, message, "custom: no endpoint");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ to: phone, from: senderId, message }),
      });
      return res.ok || logFallback(to, message, `custom ${res.status}`);
    }

    return logFallback(to, message, `provider="${provider}"`);
  } catch (error) {
    console.error("sendSms failed", error);
    return false;
  }
}

function logFallback(to: string, message: string, reason: string): boolean {
  console.info(`[sms:noop ${reason}] → ${to}: ${message}`);
  return false;
}
