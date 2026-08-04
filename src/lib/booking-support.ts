import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";

/**
 * Find or create a booking-tied support conversation (guest ↔ provider + admin).
 */
export async function ensureBookingSupportThread(opts: {
  bookingId: string;
  openerId?: string | null;
  initialMessage?: string;
  senderRole?: "TOURIST" | "PROVIDER" | "ADMIN";
}): Promise<
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; error: string; status: number }
> {
  const { data: booking } = await db
    .from("Booking")
    .select(
      "id, reference, travelerId, guestName, guestEmail, guestPhone, listingId, listing:Listing(id, title, providerId)",
    )
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found", status: 404 };

  const listingRaw = booking.listing as
    | { id: string; title: string; providerId: string }
    | { id: string; title: string; providerId: string }[]
    | null;
  const listing = Array.isArray(listingRaw) ? listingRaw[0] : listingRaw;
  if (!listing?.providerId || !booking.listingId) {
    return { ok: false, error: "Booking has no listing/provider", status: 400 };
  }

  const { data: existing } = await db
    .from("Conversation")
    .select("id")
    .eq("bookingId", opts.bookingId)
    .maybeSingle();

  if (existing) {
    if (opts.initialMessage?.trim()) {
      await appendMessage({
        conversationId: existing.id as string,
        senderId: opts.openerId ?? null,
        senderRole: opts.senderRole || "TOURIST",
        body: opts.initialMessage.trim(),
      });
    }
    return {
      ok: true,
      conversationId: existing.id as string,
      created: false,
    };
  }

  const now = new Date().toISOString();
  const conversationId = createId();
  const { error } = await db.from("Conversation").insert({
    id: conversationId,
    listingId: booking.listingId as string,
    providerId: listing.providerId,
    travelerId: (booking.travelerId as string | null) ?? null,
    bookingId: opts.bookingId,
    kind: "BOOKING_SUPPORT",
    guestName: (booking.guestName as string | null) ?? null,
    guestEmail: (booking.guestEmail as string | null) ?? null,
    guestPhone: (booking.guestPhone as string | null) ?? null,
    subject: `Support · ${booking.reference}`,
    status: "OPEN",
    lastMessageAt: now,
    unreadForProvider: 1,
    unreadForTraveler: 0,
    createdAt: now,
    updatedAt: now,
  });

  if (error) {
    // Race: another request created it
    const { data: again } = await db
      .from("Conversation")
      .select("id")
      .eq("bookingId", opts.bookingId)
      .maybeSingle();
    if (again) {
      return {
        ok: true,
        conversationId: again.id as string,
        created: false,
      };
    }
    return { ok: false, error: error.message, status: 500 };
  }

  const body =
    opts.initialMessage?.trim() ||
    `Support thread for booking ${booking.reference} (${listing.title}).`;
  await appendMessage({
    conversationId,
    senderId: opts.openerId ?? null,
    senderRole: opts.senderRole || "TOURIST",
    body,
  });

  return { ok: true, conversationId, created: true };
}

async function appendMessage(opts: {
  conversationId: string;
  senderId: string | null;
  senderRole: string;
  body: string;
}) {
  const now = new Date().toISOString();
  await db.from("Message").insert({
    id: createId(),
    conversationId: opts.conversationId,
    senderId: opts.senderId,
    senderRole: opts.senderRole,
    body: opts.body.slice(0, 5000),
    createdAt: now,
  });
  await db
    .from("Conversation")
    .update({
      lastMessageAt: now,
      updatedAt: now,
      unreadForProvider:
        opts.senderRole === "PROVIDER"
          ? undefined
          : undefined,
    })
    .eq("id", opts.conversationId);

  // Bump unread counters simply
  if (opts.senderRole === "TOURIST" || opts.senderRole === "ADMIN") {
    const { data: c } = await db
      .from("Conversation")
      .select("unreadForProvider")
      .eq("id", opts.conversationId)
      .maybeSingle();
    await db
      .from("Conversation")
      .update({
        unreadForProvider: ((c?.unreadForProvider as number) || 0) + 1,
        lastMessageAt: now,
        updatedAt: now,
      })
      .eq("id", opts.conversationId);
  } else if (opts.senderRole === "PROVIDER") {
    const { data: c } = await db
      .from("Conversation")
      .select("unreadForTraveler")
      .eq("id", opts.conversationId)
      .maybeSingle();
    await db
      .from("Conversation")
      .update({
        unreadForTraveler: ((c?.unreadForTraveler as number) || 0) + 1,
        lastMessageAt: now,
        updatedAt: now,
      })
      .eq("id", opts.conversationId);
  }
}
