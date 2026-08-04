import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { sendEmail, appUrl } from "@/lib/email";
import { getPlatformName } from "@/lib/branding";
import { handleRouteError, jsonOk } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Request a password-reset link. Always returns success to avoid email
 * enumeration. The link is emailed when a matching account exists.
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase().trim();

    const { data: user } = await db
      .from("User")
      .select("id, email, name")
      .eq("email", email)
      .maybeSingle();

    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Invalidate older unused tokens for this email.
      await db
        .from("PasswordResetToken")
        .delete()
        .eq("email", email)
        .is("usedAt", null);

      await db.from("PasswordResetToken").insert({
        id: createId(),
        email,
        tokenHash,
        expiresAt: expires,
      });

      const link = appUrl(`/reset?token=${token}`);
      const platformName = await getPlatformName();
      await sendEmail({
        to: email,
        subject: `Reset your ${platformName} password`,
        text: `Hi ${user.name || "there"},\n\nReset your password using this link (valid for 1 hour):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
        html: `<p>Hi ${user.name || "there"},</p><p>Reset your password using this link (valid for 1 hour):</p><p><a href="${link}">${link}</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
      });
    }

    return jsonOk({
      ok: true,
      message:
        "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
