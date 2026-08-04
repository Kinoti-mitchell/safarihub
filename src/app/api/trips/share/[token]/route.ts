import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const { data: trip, error } = await db
      .from("Trip")
      .select("id, title, updatedAt, stops:TripStop(*)")
      .eq("shareToken", token)
      .maybeSingle();
    if (error) throw error;
    if (!trip) return jsonError("Not found", 404);
    const stops = ((trip.stops as Array<Record<string, unknown>>) || []).sort(
      (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0),
    );
    return jsonOk({
      trip: { id: trip.id, title: trip.title, updatedAt: trip.updatedAt },
      stops,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
