import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser, assertProviderApproved } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string; mediaId: string }> };

async function assertMediaAccess(
  userId: string,
  role: string,
  listingId: string,
  mediaId: string,
) {
  const { data: media } = await db
    .from("Media")
    .select("*, listing:Listing(providerId)")
    .eq("id", mediaId)
    .eq("listingId", listingId)
    .maybeSingle();
  if (!media) return { error: jsonError("Not found", 404) as Response };
  const access = await getProviderForUser(userId);
  const providerId = (media.listing as { providerId: string } | null)?.providerId;
  if (role !== "ADMIN" && access?.provider.id !== providerId) {
    return { error: jsonError("Forbidden", 403) as Response };
  }
  if (role !== "ADMIN" && access) {
    try {
      assertProviderApproved(access);
    } catch (e) {
      return { error: handleRouteError(e) as Response };
    }
  }
  return { media };
}

async function promoteFirstAsCover(listingId: string): Promise<void> {
  const { data: first } = await db
    .from("Media")
    .select("id")
    .eq("listingId", listingId)
    .order("sortOrder", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (first) {
    await db.from("Media").update({ isCover: true }).eq("id", first.id);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id, mediaId } = await params;
    const access = await assertMediaAccess(
      session.user.id,
      session.user.role,
      id,
      mediaId,
    );
    if (access.error) return access.error;

    const body = z
      .object({
        isCover: z.boolean().optional(),
        alt: z.string().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(await request.json());

    if (body.isCover === true) {
      await db.from("Media").update({ isCover: false }).eq("listingId", id);
    }

    const patch: Record<string, unknown> = {};
    if (body.isCover != null) patch.isCover = body.isCover;
    if (body.alt != null) patch.alt = body.alt;
    if (body.sortOrder != null) patch.sortOrder = body.sortOrder;

    const { data: media, error } = await db
      .from("Media")
      .update(patch)
      .eq("id", mediaId)
      .select("*")
      .single();
    if (error) throw error;

    // Keep at least one cover
    if (body.isCover === false) {
      const { data: cover } = await db
        .from("Media")
        .select("id")
        .eq("listingId", id)
        .eq("isCover", true)
        .limit(1)
        .maybeSingle();
      if (!cover) await promoteFirstAsCover(id);
    }

    return jsonOk({ media });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id, mediaId } = await params;
    const access = await assertMediaAccess(
      session.user.id,
      session.user.role,
      id,
      mediaId,
    );
    if (access.error) return access.error;

    const wasCover = Boolean((access.media as { isCover: boolean }).isCover);
    const { error } = await db.from("Media").delete().eq("id", mediaId);
    if (error) throw error;

    if (wasCover) await promoteFirstAsCover(id);

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
