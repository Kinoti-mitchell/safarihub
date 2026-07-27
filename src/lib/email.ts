import { getPlatformSettings, type SettingValue } from "@/lib/settings";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

function str(settings: Record<string, SettingValue>, key: string): string {
  const v = settings[key];
  return v == null ? "" : String(v);
}

/**
 * Send an email using the provider configured in Admin → Settings → Email.
 * HTTP providers (Resend / SendGrid) are called directly with fetch so no extra
 * npm dependency is required. SMTP requires a mail dependency that isn't bundled
 * here, so it degrades gracefully to a logged no-op (useful in development).
 *
 * Never throws — a failed notification must not break the underlying action.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  try {
    const settings = await getPlatformSettings();
    const provider = str(settings, "email.provider") || "disabled";
    const fromEmail =
      str(settings, "email.fromEmail") || "no-reply@safarihub.co.ke";
    const fromName = str(settings, "email.fromName") || "Safari Hub";
    const to = Array.isArray(msg.to) ? msg.to : [msg.to];
    const recipients = to.map((t) => t.trim()).filter(Boolean);
    if (recipients.length === 0) return false;

    const html = msg.html ?? `<pre>${escapeHtml(msg.text)}</pre>`;

    if (provider === "resend") {
      const apiKey = str(settings, "email.apiKey");
      if (!apiKey) return logFallback(msg, "resend: no api key");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: recipients,
          subject: msg.subject,
          text: msg.text,
          html,
        }),
      });
      return res.ok || logFallback(msg, `resend ${res.status}`);
    }

    if (provider === "sendgrid") {
      const apiKey = str(settings, "email.apiKey");
      if (!apiKey) return logFallback(msg, "sendgrid: no api key");
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map((email) => ({ email })) }],
          from: { email: fromEmail, name: fromName },
          subject: msg.subject,
          content: [
            { type: "text/plain", value: msg.text },
            { type: "text/html", value: html },
          ],
        }),
      });
      return res.ok || logFallback(msg, `sendgrid ${res.status}`);
    }

    // "smtp" or "disabled" — no HTTP transport available in this runtime.
    return logFallback(msg, `provider="${provider}"`);
  } catch (error) {
    console.error("sendEmail failed", error);
    return false;
  }
}

function logFallback(msg: EmailMessage, reason: string): boolean {
  console.info(
    `[email:noop ${reason}] → ${Array.isArray(msg.to) ? msg.to.join(", ") : msg.to} · ${msg.subject}`,
  );
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return path ? `${base}${path.startsWith("/") ? "" : "/"}${path}` : base;
}
