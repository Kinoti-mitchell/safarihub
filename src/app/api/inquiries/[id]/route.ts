import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  reply: z.string().min(1).optional(),
  status: z.enum(["NEW", "REPLIED", "CLOSED"]).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: inquiry } = await db
      .from("Inquiry")
      .select("id, providerId")
      .eq("id", id)
      .maybeSingle();
    if (!inquiry) return jsonError("Not found", 404);

    const access = await getProviderForUser(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && access?.provider.id !== inquiry.providerId) {
      return jsonError("Forbidden", 403);
    }

    const body = patchSchema.parse(await request.json());
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.reply !== undefined) patch.reply = body.reply;
    const status = body.reply ? "REPLIED" : body.status;
    if (status !== undefined) patch.status = status;

    const { data: updated, error } = await db
      .from("Inquiry")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ inquiry: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
