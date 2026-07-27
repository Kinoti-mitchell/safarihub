import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const [{ data: notifications, error }, { count }] = await Promise.all([
      db
        .from("Notification")
        .select("*")
        .eq("userId", session.user.id)
        .order("createdAt", { ascending: false })
        .limit(40),
      db
        .from("Notification")
        .select("id", { count: "exact", head: true })
        .eq("userId", session.user.id)
        .eq("read", false),
    ]);
    if (error) throw error;

    return jsonOk({
      notifications: notifications ?? [],
      unread: count ?? 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

/** Mark notifications as read. */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const body = patchSchema.parse(await request.json());

    let query = db
      .from("Notification")
      .update({ read: true })
      .eq("userId", session.user.id)
      .eq("read", false);

    if (body.all) {
      // mark all
    } else if (body.ids?.length) {
      query = query.in("id", body.ids);
    } else {
      return jsonError("Provide ids or all=true", 400);
    }

    const { error } = await query;
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
