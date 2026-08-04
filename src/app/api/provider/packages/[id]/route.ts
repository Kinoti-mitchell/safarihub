import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireProviderAccess, assertProviderApproved } from "@/lib/provider";
import { logAudit } from "@/lib/audit";
import { parseBulletList } from "@/lib/tour-listing";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(8000).optional().nullable(),
  price: z.number().int().min(0).optional(),
  days: z.number().int().min(1).max(90).optional(),
  imageUrl: z.string().max(2000).optional().nullable(),
  capacity: z.number().int().min(1).max(500).optional().nullable(),
  meetingPoint: z.string().max(400).optional().nullable(),
  inclusions: z.union([z.array(z.string()), z.string()]).optional(),
  exclusions: z.union([z.array(z.string()), z.string()]).optional(),
  isPublished: z.boolean().optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        details: z.string().max(2000).optional().nullable(),
      }),
    )
    .optional(),
});

async function loadOwnedPackage(id: string, providerId: string) {
  const { data, error } = await db
    .from("TravelPackage")
    .select("*, items:PackageItem(*)")
    .eq("id", id)
    .eq("providerId", providerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    const { id } = await params;
    const pkg = await loadOwnedPackage(id, access.provider.id);
    if (!pkg) return jsonError("Not found", 404);
    return jsonOk({ package: pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    try {
      assertProviderApproved(access);
    } catch (e) {
      return handleRouteError(e);
    }
    const { id } = await params;
    const existing = await loadOwnedPackage(id, access.provider.id);
    if (!existing) return jsonError("Not found", 404);

    const body = patchSchema.parse(await request.json());
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.title != null) patch.title = body.title.trim();
    if (body.description !== undefined) {
      patch.description = body.description?.trim() || null;
    }
    if (body.price != null) patch.price = body.price;
    if (body.days != null) patch.days = body.days;
    if (body.imageUrl !== undefined) {
      patch.imageUrl = body.imageUrl?.trim() || null;
    }
    if (body.capacity !== undefined) patch.capacity = body.capacity;
    if (body.meetingPoint !== undefined) {
      patch.meetingPoint = body.meetingPoint?.trim() || null;
    }
    if (body.inclusions !== undefined) {
      patch.inclusions = parseBulletList(body.inclusions);
    }
    if (body.exclusions !== undefined) {
      patch.exclusions = parseBulletList(body.exclusions);
    }
    if (body.isPublished != null) patch.isPublished = body.isPublished;

    const { data: updated, error } = await db
      .from("TravelPackage")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    if (body.items) {
      await db.from("PackageItem").delete().eq("packageId", id);
      const itemRows = body.items.map((item) => ({
        id: createId(),
        packageId: id,
        label: item.label.trim(),
        details: item.details?.trim() || null,
      }));
      if (itemRows.length) {
        const { error: itemsError } = await db
          .from("PackageItem")
          .insert(itemRows);
        if (itemsError) throw itemsError;
      }
    }

    await logAudit({
      actor: session.user,
      action: "package.update",
      entityType: "TravelPackage",
      entityId: id,
      summary: `Provider updated package "${updated.title}"`,
    });

    const pkg = await loadOwnedPackage(id, access.provider.id);
    return jsonOk({ package: pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    const { id } = await params;
    const existing = await loadOwnedPackage(id, access.provider.id);
    if (!existing) return jsonError("Not found", 404);

    const { count } = await db
      .from("PackageBooking")
      .select("id", { count: "exact", head: true })
      .eq("packageId", id);
    if ((count ?? 0) > 0) {
      return jsonError(
        "This package has bookings — unpublish it instead of deleting",
        409,
      );
    }

    await db.from("PackageItem").delete().eq("packageId", id);
    const { error } = await db.from("TravelPackage").delete().eq("id", id);
    if (error) throw error;

    await logAudit({
      actor: session.user,
      action: "package.delete",
      entityType: "TravelPackage",
      entityId: id,
      summary: `Provider deleted package "${existing.title}"`,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
