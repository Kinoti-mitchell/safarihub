import type { NextAuthRequest } from "next-auth";
import { auth } from "@/lib/auth";
import { uploadKycDocument, uploadPublicImage } from "@/lib/uploads";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { ALLOWED_KYC_DOC_TYPES } from "@/lib/supabase";

const ALLOWED_FOLDERS = new Set(["avatars", "branding", "logos", "kyc"]);

export const POST = auth(async (req) => {
  const request = req as NextAuthRequest;
  try {
    const session = request.auth;
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError("Expected multipart/form-data", 400);
    }

    const form = await request.formData();
    const folder = String(form.get("folder") || "avatars");
    if (!ALLOWED_FOLDERS.has(folder)) {
      return jsonError("Invalid upload folder", 400);
    }
    if (folder === "branding" && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }
    if (
      folder === "logos" &&
      session.user.role !== "PROVIDER" &&
      session.user.role !== "ADMIN"
    ) {
      return jsonError("Forbidden", 403);
    }
    if (
      folder === "kyc" &&
      session.user.role !== "PROVIDER" &&
      session.user.role !== "ADMIN"
    ) {
      return jsonError("Forbidden", 403);
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError(
        folder === "kyc"
          ? "Select a document to upload"
          : "Select an image to upload",
        400,
      );
    }

    if (folder === "kyc") {
      const kind = String(form.get("kind") || "doc");
      const uploaded = await uploadKycDocument({
        ownerId: session.user.id,
        file,
        fileName: file.name || "document.pdf",
        contentType: file.type || "application/octet-stream",
        kind,
      });
      return jsonOk({ url: uploaded.publicUrl }, 201);
    }

    if (
      file.type &&
      !ALLOWED_KYC_DOC_TYPES.includes(
        file.type as (typeof ALLOWED_KYC_DOC_TYPES)[number],
      ) &&
      !file.type.startsWith("image/")
    ) {
      return jsonError("Allowed types: JPEG, PNG, WebP, GIF", 400);
    }

    const uploaded = await uploadPublicImage({
      folder,
      ownerId: session.user.id,
      file,
      fileName: file.name || "image.jpg",
      contentType: file.type || "image/jpeg",
    });

    return jsonOk({ url: uploaded.publicUrl }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});
