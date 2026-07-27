import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getProviderForUser } from "@/lib/provider";
import { getPlatformSettings, boolSetting } from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const settings = await getPlatformSettings();
    if (!boolSetting(settings, "flags.reviewsEnabled")) {
      return jsonError("Reviews are currently disabled", 400);
    }
    const body = z
      .object({
        bookingId: z.string(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      })
      .parse(await request.json());

    const { data: booking } = await db
      .from("Booking")
      .select("id, travelerId, listingId, status")
      .eq("id", body.bookingId)
      .maybeSingle();
    if (!booking || booking.travelerId !== session.user.id) {
      return jsonError("Forbidden", 403);
    }
    if (booking.status !== "COMPLETED") {
      return jsonError("Complete the stay before reviewing", 400);
    }

    const { data: review, error } = await db
      .from("Review")
      .insert({
        id: createId(),
        listingId: booking.listingId,
        bookingId: booking.id,
        travelerId: session.user.id,
        rating: body.rating,
        comment: body.comment ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ review }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    const mine = searchParams.get("mine") === "true";
    const session = await auth();

    if (mine) {
      if (!session?.user) return jsonError("Unauthorized", 401);
      const access = await getProviderForUser(session.user.id);
      if (!access) return jsonError("Forbidden", 403);
      const { data: reviews, error } = await db
        .from("Review")
        .select(
          "*, listing:Listing!inner(title, providerId), traveler:User(name)",
        )
        .eq("listing.providerId", access.provider.id)
        .order("createdAt", { ascending: false });
      if (error) throw error;
      return jsonOk({ reviews });
    }

    if (!listingId) return jsonError("listingId required", 400);
    const { data: reviews, error } = await db
      .from("Review")
      .select("*, traveler:User(name)")
      .eq("listingId", listingId)
      .order("createdAt", { ascending: false });
    if (error) throw error;
    return jsonOk({ reviews });
  } catch (error) {
    return handleRouteError(error);
  }
}
