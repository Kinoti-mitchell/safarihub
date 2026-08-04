import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getPlatformSettings, boolSetting } from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * Leave a review for a completed booking.
 * Members: session traveler. Guests: accessToken from the manage/confirmation link.
 * Review.travelerId may be null for pure guest bookings (see db/2026-tourist-ops.sql).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const settings = await getPlatformSettings();
    if (!boolSetting(settings, "flags.reviewsEnabled")) {
      return jsonError("Reviews are currently disabled", 400);
    }

    const body = z
      .object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
        accessToken: z.string().optional(),
      })
      .parse(await request.json());

    const { data: booking } = await db
      .from("Booking")
      .select("id, travelerId, listingId, status, accessToken")
      .eq("id", id)
      .maybeSingle();
    if (!booking) return jsonError("Not found", 404);
    if (booking.status !== "COMPLETED") {
      return jsonError("Complete the stay before reviewing", 400);
    }

    const tokenOk =
      Boolean(body.accessToken) &&
      Boolean(booking.accessToken) &&
      body.accessToken === (booking.accessToken as string);
    const isTraveler =
      !!session?.user && booking.travelerId === session.user.id;

    if (!isTraveler && !tokenOk) {
      if (!session?.user) return jsonError("Unauthorized", 401);
      return jsonError("Forbidden", 403);
    }

    const { data: existing } = await db
      .from("Review")
      .select("id")
      .eq("bookingId", booking.id)
      .maybeSingle();
    if (existing) return jsonError("You already reviewed this stay", 400);

    const travelerId = (booking.travelerId as string | null) || null;

    const { data: review, error } = await db
      .from("Review")
      .insert({
        id: createId(),
        listingId: booking.listingId,
        bookingId: booking.id,
        travelerId,
        rating: body.rating,
        comment: body.comment ?? null,
      })
      .select("*")
      .single();
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("travelerId") || msg.includes("null value")) {
        return jsonError(
          "Guest reviews need a database update. Run db/2026-tourist-ops.sql (nullable Review.travelerId), then try again.",
          503,
        );
      }
      throw error;
    }
    return jsonOk({ review }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
