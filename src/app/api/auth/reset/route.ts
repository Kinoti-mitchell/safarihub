import { z } from "zod";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { getPlatformSettings, numberSetting } from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(6),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const settings = await getPlatformSettings();
    const minLen = numberSetting(settings, "security.minPasswordLength") || 6;
    if (body.password.length < minLen) {
      return jsonError(`Password must be at least ${minLen} characters`, 400);
    }

    const tokenHash = hashToken(body.token);
    const { data: row } = await db
      .from("PasswordResetToken")
      .select("*")
      .eq("tokenHash", tokenHash)
      .is("usedAt", null)
      .maybeSingle();

    if (!row) return jsonError("Invalid or expired reset link", 400);
    if (new Date(row.expiresAt as string).getTime() < Date.now()) {
      return jsonError("This reset link has expired", 400);
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const { error: userError } = await db
      .from("User")
      .update({
        passwordHash,
        updatedAt: new Date().toISOString(),
      })
      .eq("email", row.email as string);
    if (userError) throw userError;

    await db
      .from("PasswordResetToken")
      .update({ usedAt: new Date().toISOString() })
      .eq("id", row.id as string);

    return jsonOk({ ok: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    return handleRouteError(error);
  }
}
