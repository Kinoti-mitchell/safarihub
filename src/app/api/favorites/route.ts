import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { data: favorites, error } = await db
      .from("Favorite")
      .select(
        "id, listingId, createdAt, listing:Listing(id, title, slug, status, media:Media(url, isCover, sortOrder), county:County(name), town:Town(name), roomTypes:RoomType(basePrice))",
      )
      .eq("userId", session.user.id)
      .order("createdAt", { ascending: false });
    if (error) throw error;

    return jsonOk({ favorites: favorites ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({ listingId: z.string() });

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const body = createSchema.parse(await request.json());

    const { data: listing } = await db
      .from("Listing")
      .select("id, status")
      .eq("id", body.listingId)
      .maybeSingle();
    if (!listing || listing.status !== "PUBLISHED") {
      return jsonError("Listing not available", 400);
    }

    const { data: existing } = await db
      .from("Favorite")
      .select("id")
      .eq("userId", session.user.id)
      .eq("listingId", body.listingId)
      .maybeSingle();
    if (existing) return jsonOk({ favorite: existing });

    const { data: favorite, error } = await db
      .from("Favorite")
      .insert({
        id: createId(),
        userId: session.user.id,
        listingId: body.listingId,
      })
      .select("id, listingId")
      .single();
    if (error) throw error;
    return jsonOk({ favorite }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    if (!listingId) return jsonError("listingId required", 400);

    const { error } = await db
      .from("Favorite")
      .delete()
      .eq("userId", session.user.id)
      .eq("listingId", listingId);
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
