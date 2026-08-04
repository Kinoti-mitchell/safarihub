import { authorizeCron } from "@/lib/cron-auth";
import { autoCompletePastBookings } from "@/lib/bookings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

/**
 * Flip past CONFIRMED/RESERVED bookings to COMPLETED (review-ready).
 * Vercel Cron: every hour (see vercel.json).
 */
export async function GET(request: Request) {
  try {
    if (!authorizeCron(request)) return jsonError("Unauthorized", 401);
    const result = await autoCompletePastBookings({ all: true });
    return jsonOk({
      ok: true,
      completed: result.completed,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
