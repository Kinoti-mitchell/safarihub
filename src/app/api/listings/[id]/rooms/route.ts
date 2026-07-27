import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getProviderForUser } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  basePrice: z.number().int().min(0),
  dayUsePrice: z.number().int().min(0).optional().nullable(),
  offerKind: z
    .enum(["ROOM", "DAY_PASS", "TABLE", "TICKET", "ACTIVITY", "PACKAGE", "OTHER"])
    .default("ROOM"),
  maxGuests: z.number().int().min(1).default(2),
  amenities: z.array(z.string()).optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: listing, error: findError } = await db
      .from("Listing")
      .select("id, providerId")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!listing) return jsonError("Not found", 404);
    const access = await getProviderForUser(session.user.id);
    if (
      session.user.role !== "ADMIN" &&
      access?.provider.id !== listing.providerId
    ) {
      return jsonError("Forbidden", 403);
    }

    const body = schema.parse(await request.json());
    const now = new Date().toISOString();
    const { data: room, error } = await db
      .from("RoomType")
      .insert({
        id: createId(),
        listingId: id,
        name: body.name,
        description: body.description ?? null,
        quantity: body.quantity,
        basePrice: body.basePrice,
        dayUsePrice: body.dayUsePrice ?? null,
        offerKind: body.offerKind ?? "ROOM",
        maxGuests: body.maxGuests,
        amenities: body.amenities || [],
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ room }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
