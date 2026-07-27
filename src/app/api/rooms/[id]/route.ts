import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: room, error: findError } = await db
      .from("RoomType")
      .select("*, listing:Listing(*)")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!room) return jsonError("Not found", 404);
    const access = await getProviderForUser(session.user.id);
    if (
      session.user.role !== "ADMIN" &&
      access?.provider.id !==
        (room.listing as { providerId: string } | null)?.providerId
    ) {
      return jsonError("Forbidden", 403);
    }

    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().int().min(1).optional(),
        basePrice: z.number().int().min(0).optional(),
        dayUsePrice: z.number().int().min(0).nullable().optional(),
        offerKind: z
          .enum([
            "ROOM",
            "DAY_PASS",
            "TABLE",
            "TICKET",
            "ACTIVITY",
            "PACKAGE",
            "OTHER",
          ])
          .optional(),
        maxGuests: z.number().int().min(1).optional(),
        amenities: z.array(z.string()).optional(),
      })
      .parse(await request.json());

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name != null) patch.name = body.name;
    if (body.description != null) patch.description = body.description;
    if (body.quantity != null) patch.quantity = body.quantity;
    if (body.basePrice != null) patch.basePrice = body.basePrice;
    if (body.dayUsePrice !== undefined) patch.dayUsePrice = body.dayUsePrice;
    if (body.offerKind != null) patch.offerKind = body.offerKind;
    if (body.maxGuests != null) patch.maxGuests = body.maxGuests;
    if (body.amenities != null) patch.amenities = body.amenities;

    const { data: updated, error } = await db
      .from("RoomType")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ room: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const { data: room, error: findError } = await db
      .from("RoomType")
      .select("*, listing:Listing(*)")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!room) return jsonError("Not found", 404);
    const access = await getProviderForUser(session.user.id);
    if (
      session.user.role !== "ADMIN" &&
      access?.provider.id !==
        (room.listing as { providerId: string } | null)?.providerId
    ) {
      return jsonError("Forbidden", 403);
    }
    const { error } = await db.from("RoomType").delete().eq("id", id);
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
