import { NextRequest } from "next/server";

/**
 * Proxies remote images so canvas poster generation is not tainted by CORS.
 * Only allows known image CDNs used by the flyer maker.
 */
const ALLOWED = [
  "images.unsplash.com",
  "plus.unsplash.com",
  "images.pexels.com",
];

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return new Response("url required", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (!ALLOWED.includes(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "image/*" },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok) {
    return new Response("upstream failed", { status: 502 });
  }

  const type = upstream.headers.get("content-type") || "image/jpeg";
  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
