import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { findIdentityClash, validateKenyanPhone } from "@/lib/identity";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  image: z.string().max(500).nullable().optional(),
});

const USER_FIELDS = "id, name, email, phone, image, role, createdAt";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { data: user, error } = await db
      .from("User")
      .select(`${USER_FIELDS}, passwordHash`)
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!user) return jsonError("Not found", 404);

    const { passwordHash, ...safeUser } = user as Record<string, unknown> & {
      passwordHash: string | null;
    };
    return jsonOk({ user: safeUser, hasPassword: Boolean(passwordHash) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = patchSchema.parse(await request.json());
    const data: Record<string, string | null> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.phone !== undefined) {
      const phoneResult = validateKenyanPhone(body.phone);
      if (phoneResult.error) return jsonError(phoneResult.error, 400);
      const phone = phoneResult.phone;
      if (phone) {
        const clash = await findIdentityClash({
          phone,
          excludeUserId: session.user.id,
        });
        if (clash) return jsonError(clash.message, 409);
      }
      data.phone = phone;
    }
    if (body.image !== undefined) data.image = body.image;

    if (Object.keys(data).length === 0) {
      return jsonError("Nothing to update", 400);
    }
    data.updatedAt = new Date().toISOString();

    const { data: user, error } = await db
      .from("User")
      .update(data)
      .eq("id", session.user.id)
      .select(USER_FIELDS)
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("unique")) {
        return jsonError(
          "An account with this phone number already exists",
          409,
        );
      }
      throw error;
    }
    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
