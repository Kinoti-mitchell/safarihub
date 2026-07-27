import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getProviderForUser, assertProviderApproved } from "@/lib/provider";
import { uploadListingImage } from "@/lib/listing-images";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };
type MediaRow = Record<string, unknown> & { id: string; isCover: boolean };

async function assertListingAccess(userId: string, role: string, listingId: string) {
  const { data: listing } = await db
    .from("Listing")
    .select("id, providerId")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { error: jsonError("Not found", 404) as Response };
  const access = await getProviderForUser(userId);
  if (role !== "ADMIN" && access?.provider.id !== listing.providerId) {
    return { error: jsonError("Forbidden", 403) as Response };
  }
  if (role !== "ADMIN" && access) {
    try {
      assertProviderApproved(access);
    } catch (e) {
      return { error: handleRouteError(e) as Response };
    }
  }
  return { listing };
}

async function countMedia(listingId: string): Promise<number> {
  const { count } = await db
    .from("Media")
    .select("id", { count: "exact", head: true })
    .eq("listingId", listingId);
  return count ?? 0;
}

async function clearCovers(listingId: string): Promise<void> {
  await db.from("Media").update({ isCover: false }).eq("listingId", listingId);
}

async function insertMedia(row: {
  listingId: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
  alt?: string | null;
}): Promise<MediaRow> {
  const { data, error } = await db
    .from("Media")
    .insert({
      id: createId(),
      ...row,
      alt: row.alt ?? null,
      createdAt: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MediaRow;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const access = await assertListingAccess(
      session.user.id,
      session.user.role,
      id,
    );
    if (access.error) return access.error;

    const contentType = request.headers.get("content-type") || "";
    const created: MediaRow[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const files = [
        ...form.getAll("files"),
        ...form.getAll("file"),
      ].filter((f): f is File => f instanceof File && f.size > 0);

      if (!files.length) return jsonError("Select at least one photo", 400);

      const existingCount = await countMedia(id);
      const rawCover = Number(form.get("coverIndex"));
      const coverIndex = Number.isFinite(rawCover)
        ? Math.min(Math.max(0, rawCover), files.length - 1)
        : 0;
      const setCoverFromBatch =
        existingCount === 0 || String(form.get("setAsCover") || "") === "true";
      const altTag = String(form.get("alt") || "").trim() || null;

      if (setCoverFromBatch) await clearCovers(id);

      let sortBase = existingCount;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await uploadListingImage({
          ownerId: session.user.id,
          listingId: id,
          file,
          fileName: file.name || `photo-${i + 1}.jpg`,
          contentType: file.type || "image/jpeg",
        });
        created.push(
          await insertMedia({
            listingId: id,
            url: uploaded.publicUrl,
            isCover: setCoverFromBatch && i === coverIndex,
            sortOrder: sortBase++,
            alt: altTag,
          }),
        );
      }

      const { data: hasCover } = await db
        .from("Media")
        .select("id")
        .eq("listingId", id)
        .eq("isCover", true)
        .limit(1)
        .maybeSingle();
      if (!hasCover && created[0]) {
        await db
          .from("Media")
          .update({ isCover: true })
          .eq("id", created[0].id);
        created[0] = { ...created[0], isCover: true };
      }

      return jsonOk({ media: created, count: created.length }, 201);
    }

    const body = z
      .object({
        url: z.string().url().optional(),
        urls: z.array(z.string().url()).optional(),
        alt: z.string().optional(),
        isCover: z.boolean().optional(),
        dataUrl: z.string().optional(),
      })
      .parse(await request.json());

    const urls: string[] = [];
    if (body.urls?.length) urls.push(...body.urls);
    if (body.url) urls.push(body.url);

    if (body.dataUrl?.startsWith("data:")) {
      const match = body.dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!match) return jsonError("Invalid dataUrl", 400);
      const buf = Buffer.from(match[2], "base64");
      const blob = new Blob([buf], { type: match[1] });
      const uploaded = await uploadListingImage({
        ownerId: session.user.id,
        listingId: id,
        file: blob,
        fileName: `upload.${match[1].split("/")[1] || "jpg"}`,
        contentType: match[1],
      });
      urls.push(uploaded.publicUrl);
    }

    if (!urls.length) return jsonError("url or files required", 400);

    const existingCount = await countMedia(id);
    const wantCover = body.isCover ?? existingCount === 0;
    if (wantCover) await clearCovers(id);

    let sortBase = existingCount;
    for (let i = 0; i < urls.length; i++) {
      created.push(
        await insertMedia({
          listingId: id,
          url: urls[i],
          alt: body.alt ?? null,
          isCover: wantCover && i === 0,
          sortOrder: sortBase++,
        }),
      );
    }

    return jsonOk({ media: created, count: created.length }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
