import { sendEmail } from "@/lib/email";
import { getPlatformSettings } from "@/lib/settings";

/** Parse Admin → Notifications → admin alert recipients. */
export function parseAdminRecipients(raw: unknown): string[] {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

/**
 * Email platform admins (comma-separated list in settings).
 * Best-effort — never throws.
 */
export async function emailAdminRecipients(msg: {
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  try {
    const settings = await getPlatformSettings();
    const recipients = parseAdminRecipients(settings["notifications.adminRecipients"]);
    if (recipients.length === 0) return;
    await sendEmail({
      to: recipients,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
  } catch (error) {
    console.error("emailAdminRecipients failed", error);
  }
}
