import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { sendEmail, appUrl } from "@/lib/email";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
};

/**
 * Create an in-app notification (the bell). Never throws — a failed
 * notification must not break the underlying action.
 */
export async function notify(input: NotificationInput): Promise<void> {
  try {
    const { error } = await db.from("Notification").insert({
      id: createId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      read: false,
    });
    if (error) throw error;
  } catch (error) {
    console.error("notify failed", error);
  }
}

/**
 * Create an in-app notification AND email the user, when we have their address.
 * `emailFlag` gates outbound email via Admin → Notifications toggles.
 * Best-effort, never throws.
 */
export async function notifyAndEmail(input: {
  userId?: string | null;
  email?: string | null;
  type: string;
  title: string;
  body?: string;
  href?: string;
  /** Settings key such as notifications.emailOnBooking — when false, skip email. */
  emailFlag?: string;
}): Promise<void> {
  if (input.userId) {
    await notify({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    });
  }
  if (!input.email) return;

  try {
    if (input.emailFlag) {
      const settings = await getPlatformSettings();
      if (!boolSetting(settings, input.emailFlag)) return;
    }
    const link = input.href ? appUrl(input.href) : appUrl();
    await sendEmail({
      to: input.email,
      subject: input.title,
      text: `${input.body ?? input.title}\n\n${link}`,
    });
  } catch (error) {
    console.error("notifyAndEmail email failed", error);
  }
}

/** Unread notification count for a user. */
export async function unreadCount(userId: string): Promise<number> {
  const { count } = await db
    .from("Notification")
    .select("id", { count: "exact", head: true })
    .eq("userId", userId)
    .eq("read", false);
  return count ?? 0;
}
