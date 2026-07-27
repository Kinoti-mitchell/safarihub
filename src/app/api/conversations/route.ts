import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getProviderForUser } from "@/lib/provider";
import { notify } from "@/lib/notify";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

/**
 * List conversations for the current user.
 * - Provider: threads for their listings (their inbox).
 * - Admin: all threads.
 * - Tourist: threads they started.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    let query = db
      .from("Conversation")
      .select(
        "*, listing:Listing(id, title, slug), traveler:User(id, name, email), provider:Provider(id, name, slug)",
      )
      .order("lastMessageAt", { ascending: false })
      .limit(100);

    if (session.user.role === "ADMIN") {
      // no filter
    } else {
      const access = await getProviderForUser(session.user.id);
      if (access) {
        query = query.eq("providerId", access.provider.id);
      } else {
        query = query.eq("travelerId", session.user.id);
      }
    }

    const { data: conversations, error } = await query;
    if (error) throw error;
    return jsonOk({ conversations });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  listingId: z.string(),
  message: z.string().min(2).max(4000),
  subject: z.string().max(160).optional(),
});

/**
 * Tourist starts (or continues) a conversation about a listing from the listing
 * page. Get-or-creates the thread, appends the message, and alerts the provider.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Please sign in to message the provider", 401);

    const body = createSchema.parse(await request.json());
    const { data: listing } = await db
      .from("Listing")
      .select("id, title, slug, providerId, status")
      .eq("id", body.listingId)
      .maybeSingle();
    if (!listing || listing.status !== "PUBLISHED") {
      return jsonError("Listing not available", 400);
    }

    const now = new Date().toISOString();

    // Get-or-create the (listing, traveler) thread.
    const { data: existing } = await db
      .from("Conversation")
      .select("*")
      .eq("listingId", listing.id)
      .eq("travelerId", session.user.id)
      .maybeSingle();

    let conversationId: string;
    if (existing) {
      conversationId = existing.id as string;
      await db
        .from("Conversation")
        .update({
          status: "OPEN",
          lastMessageAt: now,
          updatedAt: now,
          unreadForProvider: (existing.unreadForProvider as number) + 1,
        })
        .eq("id", conversationId);
    } else {
      conversationId = createId();
      const { error: convError } = await db.from("Conversation").insert({
        id: conversationId,
        listingId: listing.id,
        providerId: listing.providerId,
        travelerId: session.user.id,
        guestName: session.user.name ?? null,
        guestEmail: session.user.email ?? null,
        subject: body.subject ?? listing.title,
        status: "OPEN",
        lastMessageAt: now,
        unreadForProvider: 1,
        unreadForTraveler: 0,
      });
      if (convError) throw convError;
    }

    const { error: msgError } = await db.from("Message").insert({
      id: createId(),
      conversationId,
      senderId: session.user.id,
      senderRole: "TOURIST",
      body: body.message,
    });
    if (msgError) throw msgError;

    // Notify every member of the provider workspace.
    const { data: members } = await db
      .from("ProviderMember")
      .select("userId")
      .eq("providerId", listing.providerId);
    for (const m of members ?? []) {
      await notify({
        userId: m.userId as string,
        type: "message.new",
        title: `New question · ${listing.title}`,
        body: `${session.user.name || "A guest"}: ${body.message.slice(0, 120)}`,
        href: "/provider/inbox",
      });
    }

    return jsonOk({ conversationId }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
