import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  ALLOWED_KYC_DOC_TYPES,
  ALLOWED_LISTING_IMAGE_TYPES,
  createSupabaseAdminClient,
  isSupabaseConfigured,
  LISTING_IMAGES_BUCKET,
  MAX_KYC_DOC_BYTES,
  MAX_LISTING_IMAGE_BYTES,
} from "@/lib/supabase";

async function storePublicFile(opts: {
  folder: string;
  ownerId: string;
  file: File | Blob;
  fileName: string;
  contentType: string;
  defaultName: string;
}) {
  const safeFolder =
    opts.folder
      .split("/")
      .map((seg) => seg.replace(/[^a-z0-9-]/gi, "").slice(0, 32))
      .filter(Boolean)
      .join("/")
      .slice(0, 80) || "misc";
  const safeName =
    opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
    opts.defaultName;
  const storagePath = `${safeFolder}/${opts.ownerId}/${Date.now()}-${safeName}`;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      const { error: uploadError } = await supabase.storage
        .from(LISTING_IMAGES_BUCKET)
        .upload(storagePath, opts.file, {
          upsert: false,
          contentType: opts.contentType || "application/octet-stream",
        });
      if (!uploadError) {
        const { data } = supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .getPublicUrl(storagePath);
        return { storagePath, publicUrl: data.publicUrl };
      }
      console.warn(
        "Supabase upload failed, using local fallback:",
        uploadError.message,
      );
    } catch (err) {
      console.warn("Supabase upload error, using local fallback:", err);
    }
  }

  const bytes = Buffer.from(await opts.file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", ...safeFolder.split("/"));
  await mkdir(dir, { recursive: true });
  const localName = `${Date.now()}-${safeName}`;
  await writeFile(path.join(dir, localName), bytes);
  return {
    storagePath: `local:${safeFolder}/${localName}`,
    publicUrl: `/uploads/${safeFolder}/${localName}`,
  };
}

/**
 * Generic image uploader for avatars, branding, etc. Uploads to Supabase
 * Storage when configured, otherwise falls back to public/uploads/<folder>.
 * Mirrors the listing-image uploader so behaviour stays consistent.
 */
export async function uploadPublicImage(opts: {
  folder: string;
  ownerId: string;
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

  return storePublicFile({
    ...opts,
    defaultName: "image.jpg",
  });
}

/**
 * KYC / KYB documents (owner ID, registration certificate, permits).
 * Allows images + PDF, slightly larger size limit.
 */
export async function uploadKycDocument(opts: {
  ownerId: string;
  file: File | Blob;
  fileName: string;
  contentType: string;
  kind?: string;
}) {
  if (opts.file.size > MAX_KYC_DOC_BYTES) {
    throw new Error("Document must be 8 MB or smaller");
  }
  if (
    opts.contentType &&
    !ALLOWED_KYC_DOC_TYPES.includes(
      opts.contentType as (typeof ALLOWED_KYC_DOC_TYPES)[number],
    )
  ) {
    throw new Error("Allowed types: JPEG, PNG, WebP, GIF, PDF");
  }

  const kind =
    (opts.kind || "doc").replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "doc";
  return storePublicFile({
    folder: `kyc/${kind}`,
    ownerId: opts.ownerId,
    file: opts.file,
    fileName: opts.fileName,
    contentType: opts.contentType,
    defaultName: "document.pdf",
  });
}
