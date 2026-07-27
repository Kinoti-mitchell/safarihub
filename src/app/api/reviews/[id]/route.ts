import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: review } = await db
      .from("Review")
      .select("*, listing:Listing(providerId)")
      .eq("id", id)
      .maybeSingle();
    if (!review) return jsonError("Not found", 404);

    const access = await getProviderForUser(session.user.id);
    const providerId = (review.listing as { providerId: string } | null)
      ?.providerId;
    if (session.user.role !== "ADMIN" && access?.provider.id !== providerId) {
      return jsonError("Forbidden", 403);
    }

    const body = z.object({ reply: z.string().min(1) }).parse(await request.json());
    const { data: updated, error } = await db
      .from("Review")
      .update({ reply: body.reply, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ review: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
