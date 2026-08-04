import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { ensureBookingSupportThread } from "@/lib/booking-support";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get("t");

    const { data: booking } = await db
      .from("Booking")
      .select("id, travelerId, accessToken, listing:Listing(providerId)")
      .eq("id", id)
      .maybeSingle();
    if (!booking) return jsonError("Not found", 404);

    const tokenOk =
      Boolean(token) &&
      Boolean(booking.accessToken) &&
      token === (booking.accessToken as string);

    const access = session?.user
      ? await getProviderForUser(session.user.id)
      : null;
    const listingRaw = booking.listing as
      | { providerId: string }
      | { providerId: string }[]
      | null;
    const listing = Array.isArray(listingRaw) ? listingRaw[0] : listingRaw;
    const isOwner = access?.provider.id === listing?.providerId;
    const isAdmin = session?.user?.role === "ADMIN";
    const isTraveler =
      !!session?.user && booking.travelerId === session.user.id;

    if (!tokenOk && !isTraveler && !isOwner && !isAdmin) {
      return jsonError("Forbidden", 403);
    }

    const body = z
      .object({
        message: z.string().max(5000).optional(),
      })
      .parse(await request.json().catch(() => ({})));

    const senderRole = isAdmin
      ? "ADMIN"
      : isOwner
        ? "PROVIDER"
        : "TOURIST";

    const result = await ensureBookingSupportThread({
      bookingId: id,
      openerId: session?.user?.id ?? null,
      initialMessage: body.message,
      senderRole,
    });
    if (!result.ok) return jsonError(result.error, result.status);

    return jsonOk({
      conversationId: result.conversationId,
      created: result.created,
      href:
        isAdmin
          ? `/admin/inbox?c=${result.conversationId}`
          : isOwner
            ? `/provider/inbox?c=${result.conversationId}`
            : `/account/messages?c=${result.conversationId}`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { data } = await db
      .from("Conversation")
      .select("id, subject, status, lastMessageAt, kind")
      .eq("bookingId", id)
      .maybeSingle();

    return jsonOk({ conversation: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
