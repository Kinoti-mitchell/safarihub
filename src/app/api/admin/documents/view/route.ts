import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  getSupabaseUrl,
  isSupabaseConfigured,
  LISTING_IMAGES_BUCKET,
} from "@/lib/supabase";
import { requireRole } from "@/lib/session";
import { handleRouteError } from "@/lib/http";

/**
 * Admin-only document viewer. Streams KYC/KYB files so reviewers can open
 * uploads even when the storage bucket is not publicly readable.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const raw = request.nextUrl.searchParams.get("url");
    if (!raw?.trim()) {
      return new Response("url required", { status: 400 });
    }

    const url = raw.trim();

    if (url.startsWith("/uploads/")) {
      return serveLocalUpload(url);
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return new Response("invalid url", { status: 400 });
    }

    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return new Response("invalid protocol", { status: 400 });
    }

    const supabaseBase = getSupabaseUrl();
    if (supabaseBase && isSupabaseConfigured()) {
      let supabaseHost = "";
      try {
        supabaseHost = new URL(supabaseBase).hostname;
      } catch {
        supabaseHost = "";
      }
      if (supabaseHost && target.hostname === supabaseHost) {
        const streamed = await serveSupabaseObject(target);
        if (streamed) return streamed;
      }
    }

    // Fallback: fetch public URL (works when bucket is public).
    const upstream = await fetch(target.toString(), {
      headers: { Accept: "image/*,application/pdf,*/*" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new Response("document unavailable", { status: 502 });
    }
    const type =
      upstream.headers.get("content-type") || guessContentType(target.pathname);
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: viewHeaders(type),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

async function serveLocalUpload(publicPath: string) {
  const relative = publicPath.replace(/^\/uploads\//, "");
  if (
    relative.includes("..") ||
    relative.includes("\\") ||
    path.isAbsolute(relative)
  ) {
    return new Response("invalid path", { status: 400 });
  }
  const filePath = path.join(process.cwd(), "public", "uploads", relative);
  try {
    const buf = await readFile(filePath);
    return new Response(buf, {
      status: 200,
      headers: viewHeaders(guessContentType(filePath)),
    });
  } catch {
    return new Response("file not found", { status: 404 });
  }
}

async function serveSupabaseObject(target: URL): Promise<Response | null> {
  // /storage/v1/object/public/<bucket>/<path>
  // /storage/v1/object/sign/<bucket>/<path>
  const match = target.pathname.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
  );
  if (!match) return null;

  const bucket = decodeURIComponent(match[1]);
  const objectPath = decodeURIComponent(match[2]);
  if (bucket !== LISTING_IMAGES_BUCKET) return null;
  if (!objectPath || objectPath.includes("..")) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(objectPath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    const type = data.type || guessContentType(objectPath);
    return new Response(buf, {
      status: 200,
      headers: viewHeaders(type),
    });
  } catch {
    return null;
  }
}

function guessContentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function viewHeaders(contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
}
