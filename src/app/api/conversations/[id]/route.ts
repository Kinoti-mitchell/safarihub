import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { notify } from "@/lib/notify";
import { resolveConversationAccess } from "@/lib/conversations";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** Fetch a conversation thread + messages. Clears unread for the viewer. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;

    const { data: conversation, error } = await db
      .from("Conversation")
      .select(
        "*, listing:Listing(id, title, slug), traveler:User(id, name, email, phone), provider:Provider(id, name, slug)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) return jsonError("Not found", 404);

    const access = await resolveConversationAccess(session, {
      providerId: conversation.providerId as string,
      travelerId: conversation.travelerId as string | null,
    });
    if (!access.allowed) return jsonError("Forbidden", 403);

    const { data: messages, error: msgError } = await db
      .from("Message")
      .select("*, sender:User(id, name, email)")
      .eq("conversationId", id)
      .order("createdAt", { ascending: true });
    if (msgError) throw msgError;

    // Clear unread for the viewer.
    const now = new Date().toISOString();
    if (access.viewer === "PROVIDER" || access.viewer === "ADMIN") {
      await db
        .from("Conversation")
        .update({ unreadForProvider: 0, updatedAt: now })
        .eq("id", id);
    } else if (access.viewer === "TRAVELER") {
      await db
        .from("Conversation")
        .update({ unreadForTraveler: 0, updatedAt: now })
        .eq("id", id);
    }

    return jsonOk({
      conversation: { ...conversation, unreadForProvider: 0, unreadForTraveler: 0 },
      messages: messages ?? [],
      viewer: access.viewer,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const replySchema = z.object({
  message: z.string().min(1).max(4000),
  close: z.boolean().optional(),
});

/** Reply in a conversation (provider inbox or tourist thread). */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const body = replySchema.parse(await request.json());

    const { data: conversation } = await db
      .from("Conversation")
      .select("*, listing:Listing(id, title)")
      .eq("id", id)
      .maybeSingle();
    if (!conversation) return jsonError("Not found", 404);

    const access = await resolveConversationAccess(session, {
      providerId: conversation.providerId as string,
      travelerId: conversation.travelerId as string | null,
    });
    if (!access.allowed || !access.viewer) return jsonError("Forbidden", 403);

    const senderRole =
      access.viewer === "ADMIN"
        ? "ADMIN"
        : access.viewer === "PROVIDER"
          ? "PROVIDER"
          : "TOURIST";

    const now = new Date().toISOString();
    const { error: msgError } = await db.from("Message").insert({
      id: createId(),
      conversationId: id,
      senderId: session.user.id,
      senderRole,
      body: body.message,
    });
    if (msgError) throw msgError;

    const patch: Record<string, unknown> = {
      lastMessageAt: now,
      updatedAt: now,
      status: body.close ? "CLOSED" : "OPEN",
    };
    if (senderRole === "PROVIDER" || senderRole === "ADMIN") {
      patch.unreadForTraveler =
        ((conversation.unreadForTraveler as number) || 0) + 1;
    } else {
      patch.unreadForProvider =
        ((conversation.unreadForProvider as number) || 0) + 1;
    }
    await db.from("Conversation").update(patch).eq("id", id);

    const listing = conversation.listing as { title?: string } | null;
    const title = listing?.title || "your listing";

    if (senderRole === "PROVIDER" || senderRole === "ADMIN") {
      if (conversation.travelerId) {
        await notify({
          userId: conversation.travelerId as string,
          type: "message.reply",
          title: `Reply · ${title}`,
          body: `${session.user.name || "Provider"}: ${body.message.slice(0, 120)}`,
          href: "/account/messages",
        });
      }
    } else {
      const { data: members } = await db
        .from("ProviderMember")
        .select("userId")
        .eq("providerId", conversation.providerId as string);
      for (const m of members ?? []) {
        await notify({
          userId: m.userId as string,
          type: "message.new",
          title: `New message · ${title}`,
          body: `${session.user.name || "Guest"}: ${body.message.slice(0, 120)}`,
          href: "/provider/inbox",
        });
      }
    }

    return jsonOk({ ok: true }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
