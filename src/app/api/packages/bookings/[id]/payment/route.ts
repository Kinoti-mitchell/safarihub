import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { refreshMpesaPackagePaymentStatus } from "@/lib/payments";

type Params = { params: Promise<{ id: string }> };

/**
 * Poll M-Pesa / payment status for a package booking.
 * Members: must own the booking. Guests: pass ?t=accessToken from checkout.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t");

    const { data: booking, error } = await db
      .from("PackageBooking")
      .select("id, travelerId, paymentMethod, accessToken")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return jsonError("Not found", 404);

    const isOwner =
      !!session?.user && booking.travelerId === session.user.id;
    const isAdmin = session?.user?.role === "ADMIN";
    const tokenOk =
      Boolean(token) &&
      Boolean(booking.accessToken) &&
      token === (booking.accessToken as string);

    if (!isOwner && !isAdmin && !tokenOk) {
      return jsonError("Unauthorized", 401);
    }

    const status = await refreshMpesaPackagePaymentStatus(id);
    return jsonOk({
      bookingId: id,
      ...status,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
