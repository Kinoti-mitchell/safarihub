import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getPlatformSettings, numberSetting } from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = z
      .object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(6).max(200),
      })
      .parse(await request.json());

    const settings = await getPlatformSettings();
    const minLen = numberSetting(settings, "security.minPasswordLength") || 6;
    if (body.newPassword.length < minLen) {
      return jsonError(`Password must be at least ${minLen} characters`, 400);
    }

    const { data: user, error: readError } = await db
      .from("User")
      .select("passwordHash")
      .eq("id", session.user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!user) return jsonError("Not found", 404);

    // Accounts that already have a password must confirm the current one.
    if (user.passwordHash) {
      if (!body.currentPassword) {
        return jsonError("Enter your current password", 400);
      }
      const ok = await bcrypt.compare(
        body.currentPassword,
        user.passwordHash as string,
      );
      if (!ok) return jsonError("Current password is incorrect", 400);
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    const { error: updateError } = await db
      .from("User")
      .update({ passwordHash, updatedAt: new Date().toISOString() })
      .eq("id", session.user.id);
    if (updateError) throw updateError;

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
