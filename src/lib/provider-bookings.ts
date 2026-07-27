import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { autoCompletePastBookings } from "@/lib/bookings";

const PROVIDER_BOOKING_SELECT =
  "*, listing:Listing!inner(*), traveler:User(name, email, phone), roomType:RoomType(*)";

/**
 * Bookings for the active provider business (or all, for admin).
 * Returns [] when the user has no provider access.
 */
export async function listBookingsForProviderUser(opts: {
  userId: string;
  role: string;
}) {
  if (opts.role === "ADMIN") {
    const { data, error } = await db
      .from("Booking")
      .select(
        "*, listing:Listing(*), traveler:User(name, email, phone), roomType:RoomType(*)",
      )
      .order("createdAt", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  const access = await getProviderForUser(opts.userId);
  if (!access) return [];

  const { data: listingIdRows } = await db
    .from("Listing")
    .select("id")
    .eq("providerId", access.provider.id);
  const listingIds = (listingIdRows ?? []).map((r) => r.id as string);
  await autoCompletePastBookings({ listingIds });

  const { data, error } = await db
    .from("Booking")
    .select(PROVIDER_BOOKING_SELECT)
    .eq("listing.providerId", access.provider.id)
    .order("createdAt", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBookingForProviderReview(opts: {
  bookingId: string;
  userId: string;
  role: string;
}) {
  const { data: booking, error } = await db
    .from("Booking")
    .select(
      "*, listing:Listing(*, county:County(name)), traveler:User(id, name, email, phone), roomType:RoomType(*), payments:Payment(*)",
    )
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return null;

  const listing = booking.listing as { providerId?: string } | null;
  const access = await getProviderForUser(opts.userId);
  const isAdmin = opts.role === "ADMIN";
  const isOwner = access?.provider.id === listing?.providerId;
  if (!isAdmin && !isOwner) return null;

  let priorBookings: Array<Record<string, unknown>> = [];
  const providerId = listing?.providerId;
  if (providerId) {
    const guestEmail =
      (booking.guestEmail as string | null) ||
      (booking.traveler as { email?: string | null } | null)?.email ||
      null;
    const travelerId = booking.travelerId as string | null;

    let historyQuery = db
      .from("Booking")
      .select(
        "id, reference, status, paymentStatus, checkIn, checkOut, totalAmount, roomsBooked, guests, listing:Listing!inner(title, providerId)",
      )
      .eq("listing.providerId", providerId)
      .neq("id", opts.bookingId)
      .order("checkIn", { ascending: false })
      .limit(8);

    if (travelerId) {
      historyQuery = historyQuery.eq("travelerId", travelerId);
    } else if (guestEmail) {
      historyQuery = historyQuery.eq("guestEmail", guestEmail);
    } else {
      historyQuery = historyQuery.eq("id", "__none__");
    }

    const { data: history } = await historyQuery;
    priorBookings = (history ?? []) as Array<Record<string, unknown>>;
  }

  return { booking, priorBookings };
}
