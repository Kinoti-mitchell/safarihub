import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { getBookingForProviderReview } from "@/lib/provider-bookings";
import { cancelBooking } from "@/lib/cancel-booking";
import { notifyAndEmail } from "@/lib/notify";
import { emailTouristBookingConfirmed } from "@/lib/booking-emails";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;

    if (session.user.role === "PROVIDER" || session.user.role === "ADMIN") {
      const result = await getBookingForProviderReview({
        bookingId: id,
        userId: session.user.id,
        role: session.user.role,
      });
      if (!result) return jsonError("Not found", 404);
      return jsonOk(result);
    }

    const { data: booking, error } = await db
      .from("Booking")
      .select(
        "*, listing:Listing(*, county:County(name)), traveler:User(id, name, email, phone), roomType:RoomType(*), payments:Payment(*)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return jsonError("Not found", 404);
    if (booking.travelerId !== session.user.id) {
      return jsonError("Forbidden", 403);
    }
    return jsonOk({ booking, priorBookings: [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get("t");

    const { data: booking } = await db
      .from("Booking")
      .select(
        "*, listing:Listing(*), traveler:User(id, name, email), roomType:RoomType(name)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!booking) return jsonError("Not found", 404);

    const body = z
      .object({
        status: z
          .enum([
            "PENDING",
            "RESERVED",
            "CONFIRMED",
            "CANCELLED",
            "COMPLETED",
            "NO_SHOW",
          ])
          .optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(await request.json());

    const tokenOk =
      Boolean(token) &&
      Boolean(booking.accessToken) &&
      token === (booking.accessToken as string);

    const access = session?.user
      ? await getProviderForUser(session.user.id)
      : null;
    const isAdmin = session?.user?.role === "ADMIN";
    const listing = booking.listing as {
      providerId: string;
      title?: string;
    } | null;
    const isOwner = access?.provider.id === listing?.providerId;
    const isTraveler =
      !!session?.user && booking.travelerId === session.user.id;

    if (body.status === "CANCELLED") {
      // Guest cancel via magic link token (same as receipt access).
      if (tokenOk && !session?.user) {
        const checkIn = new Date(booking.checkIn as string);
        if (checkIn.getTime() <= Date.now()) {
          return jsonError(
            "Too late to cancel — contact support or the host for help",
            400,
          );
        }
        const result = await cancelBooking({
          bookingId: id,
          cancelledById: null,
          reason: body.reason,
        });
        if (!result.ok) return jsonError(result.error, result.status);
        const { data: updated } = await db
          .from("Booking")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        return jsonOk({ booking: updated });
      }

      if (!session?.user) return jsonError("Unauthorized", 401);
      if (!isAdmin && !isOwner && !isTraveler) {
        return jsonError("Forbidden", 403);
      }
      if (isTraveler && !isOwner && !isAdmin) {
        const checkIn = new Date(booking.checkIn as string);
        if (checkIn.getTime() <= Date.now()) {
          return jsonError(
            "Too late to cancel — contact the provider for help",
            400,
          );
        }
      }
      const result = await cancelBooking({
        bookingId: id,
        cancelledById: session.user.id,
        reason: body.reason,
      });
      if (!result.ok) return jsonError(result.error, result.status);
      const { data: updated } = await db
        .from("Booking")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return jsonOk({ booking: updated });
    }

    if (!session?.user) return jsonError("Unauthorized", 401);
    if (!isAdmin && !isOwner && !isTraveler) {
      return jsonError("Forbidden", 403);
    }

    if (
      (body.status === "CONFIRMED" ||
        body.status === "COMPLETED" ||
        body.status === "NO_SHOW" ||
        body.status === "RESERVED") &&
      !isOwner &&
      !isAdmin
    ) {
      return jsonError("Forbidden", 403);
    }

    if (!body.status) return jsonError("No status provided", 400);

    const { data: updated, error } = await db
      .from("Booking")
      .update({ status: body.status, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    if (body.status === "CONFIRMED") {
      const traveler = booking.traveler as {
        name?: string | null;
        email?: string | null;
      } | null;
      const roomType = booking.roomType as { name?: string } | null;
      const emailed = await emailTouristBookingConfirmed({
        id,
        reference: booking.reference as string,
        status: "CONFIRMED",
        checkIn: booking.checkIn as string,
        checkOut: booking.checkOut as string,
        stayType: (booking.stayType as string | null) ?? null,
        dayStartTime: (booking.dayStartTime as string | null) ?? null,
        dayEndTime: (booking.dayEndTime as string | null) ?? null,
        guests: (booking.guests as number | null) ?? null,
        roomsBooked: (booking.roomsBooked as number | null) ?? null,
        totalAmount: (booking.totalAmount as number | null) ?? null,
        paymentMethod: (booking.paymentMethod as string | null) ?? null,
        paymentStatus: (booking.paymentStatus as string | null) ?? null,
        guestName: (booking.guestName as string | null) ?? null,
        guestEmail: (booking.guestEmail as string | null) ?? null,
        guestPhone: (booking.guestPhone as string | null) ?? null,
        travelerId: (booking.travelerId as string | null) ?? null,
        accessToken: (booking.accessToken as string | null) ?? null,
        listingTitle: listing?.title ?? null,
        roomName: roomType?.name ?? null,
        travelerEmail: traveler?.email ?? null,
        travelerName: traveler?.name ?? null,
      });
      return jsonOk({ booking: updated, emailed });
    }

    if (body.status === "COMPLETED") {
      const traveler = booking.traveler as {
        email?: string | null;
      } | null;
      const guestEmail =
        (booking.guestEmail as string | null) || traveler?.email || null;
      const tokenHref = booking.accessToken
        ? `/bookings/${id}?t=${booking.accessToken as string}`
        : "/account";
      await notifyAndEmail({
        userId: (booking.travelerId as string | null) ?? null,
        email: guestEmail,
        type: "booking.completed",
        title: `Stay completed · ${listing?.title || booking.reference}`,
        body: `Thanks for staying — your booking ${booking.reference} is marked completed. We hope you enjoyed ${listing?.title || "your trip"}.`,
        href: tokenHref,
      });
    }

    return jsonOk({ booking: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
