import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { getPlatformName } from "@/lib/branding";
import { buildBookingIcs } from "@/lib/ics";
import { handleRouteError, jsonError } from "@/lib/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get("t");
    const session = await auth();

    const { data: booking } = await db
      .from("Booking")
      .select(
        "id, reference, checkIn, checkOut, accessToken, travelerId, listingId, listing:Listing(title, address)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!booking) return jsonError("Not found", 404);

    const tokenOk =
      Boolean(token) &&
      Boolean(booking.accessToken) &&
      token === (booking.accessToken as string);

    let allowed = tokenOk;
    if (!allowed && session?.user) {
      const access = await getProviderForUser(session.user.id);
      const { data: listingRow } = await db
        .from("Listing")
        .select("providerId")
        .eq("id", booking.listingId as string)
        .maybeSingle();
      allowed =
        booking.travelerId === session.user.id ||
        session.user.role === "ADMIN" ||
        (!!access && listingRow?.providerId === access.provider.id);
    }
    if (!allowed) return jsonError("Forbidden", 403);

    const listing = booking.listing as {
      title?: string;
      address?: string | null;
    } | null;
    const manageUrl = token
      ? `${url.origin}/bookings/${id}?t=${token}`
      : `${url.origin}/bookings/${id}`;

    const platformName = await getPlatformName();
    const ics = buildBookingIcs({
      uid: `${booking.reference}@platform`,
      title: listing?.title
        ? `${listing.title} · ${booking.reference}`
        : `Booking ${booking.reference}`,
      description: `${platformName} booking ${booking.reference}. Manage: ${manageUrl}`,
      location: listing?.address || listing?.title || undefined,
      startISO: booking.checkIn as string,
      endISO: booking.checkOut as string,
      url: manageUrl,
      platformName,
    });

    const slug = platformName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "booking";

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-${booking.reference}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
