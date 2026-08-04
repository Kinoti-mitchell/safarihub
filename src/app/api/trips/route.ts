import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const stopSchema = z.object({
  listingId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  href: z.string().max(500).optional().nullable(),
  kind: z.string().max(40).optional().nullable(),
  checkIn: z.string().max(40).optional().nullable(),
  checkOut: z.string().max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { data: trip, error } = await db
      .from("Trip")
      .select("*, stops:TripStop(*)")
      .eq("userId", session.user.id)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    if (!trip) {
      return jsonOk({ trip: null, stops: [] });
    }

    const stops = ((trip.stops as Array<Record<string, unknown>>) || []).sort(
      (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0),
    );
    return jsonOk({
      trip: {
        id: trip.id,
        title: trip.title,
        shareToken: trip.shareToken,
        updatedAt: trip.updatedAt,
      },
      stops,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = z
      .object({
        title: z.string().max(120).optional(),
        stops: z.array(stopSchema).max(20),
      })
      .parse(await request.json());

    const now = new Date().toISOString();
    let { data: trip } = await db
      .from("Trip")
      .select("id, shareToken")
      .eq("userId", session.user.id)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!trip) {
      const id = createId();
      const shareToken = createId().slice(0, 16);
      const { error } = await db.from("Trip").insert({
        id,
        userId: session.user.id,
        shareToken,
        title: body.title || "My trip",
        createdAt: now,
        updatedAt: now,
      });
      if (error) throw error;
      trip = { id, shareToken };
    } else {
      await db
        .from("Trip")
        .update({
          title: body.title || "My trip",
          updatedAt: now,
        })
        .eq("id", trip.id as string);
    }

    await db.from("TripStop").delete().eq("tripId", trip.id as string);

    if (body.stops.length) {
      const rows = body.stops.map((s, i) => ({
        id: createId(),
        tripId: trip!.id as string,
        listingId: s.listingId ?? null,
        title: s.title,
        href: s.href ?? null,
        kind: s.kind ?? null,
        checkIn: s.checkIn ?? null,
        checkOut: s.checkOut ?? null,
        sortOrder: s.sortOrder ?? i,
        addedAt: now,
      }));
      const { error } = await db.from("TripStop").insert(rows);
      if (error) throw error;
    }

    return jsonOk({
      trip: {
        id: trip.id,
        shareToken: trip.shareToken,
        title: body.title || "My trip",
      },
      stopCount: body.stops.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
