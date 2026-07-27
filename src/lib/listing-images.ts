import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  ALLOWED_LISTING_IMAGE_TYPES,
  createSupabaseAdminClient,
  isSupabaseConfigured,
  LISTING_IMAGES_BUCKET,
  MAX_LISTING_IMAGE_BYTES,
} from "@/lib/supabase";

/**
 * Upload listing images to Supabase Storage when configured;
 * otherwise save under public/uploads/listings (local/dev fallback).
 */
export async function uploadListingImage(opts: {
  ownerId: string;
  listingId: string;
  file: File | Blob;
  fileName: string;
  contentType: string;
}) {
  if (opts.file.size > MAX_LISTING_IMAGE_BYTES) {
    throw new Error("Image must be 5 MB or smaller");
  }
  if (
    opts.contentType &&
    !ALLOWED_LISTING_IMAGE_TYPES.includes(
      opts.contentType as (typeof ALLOWED_LISTING_IMAGE_TYPES)[number],
    )
  ) {
    throw new Error("Allowed types: JPEG, PNG, WebP, GIF");
  }

  const safeName = opts.fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120) || "image.jpg";
  const storagePath = `${opts.ownerId}/${opts.listingId}/${Date.now()}-${safeName}`;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      const { error: uploadError } = await supabase.storage
        .from(LISTING_IMAGES_BUCKET)
        .upload(storagePath, opts.file, {
          upsert: false,
          contentType: opts.contentType || "image/jpeg",
        });

      if (!uploadError) {
        const { data } = supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .getPublicUrl(storagePath);
        return { storagePath, publicUrl: data.publicUrl };
      }

      // Fall through to local disk if bucket missing / storage not set up
      console.warn("Supabase upload failed, using local fallback:", uploadError.message);
    } catch (err) {
      console.warn("Supabase upload error, using local fallback:", err);
    }
  }

  const bytes = Buffer.from(await opts.file.arrayBuffer());
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "listings",
    opts.listingId,
  );
  await mkdir(dir, { recursive: true });
  const localName = `${Date.now()}-${safeName}`;
  await writeFile(path.join(dir, localName), bytes);
  return {
    storagePath: `local:${opts.listingId}/${localName}`,
    publicUrl: `/uploads/listings/${opts.listingId}/${localName}`,
  };
}

export async function deleteListingImage(storagePath: string) {
  if (storagePath.startsWith("local:")) return;
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(error.message);
}
