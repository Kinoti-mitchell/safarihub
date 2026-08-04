/**
 * Authorize Vercel Cron (or manual) calls.
 * Prefer Authorization: Bearer $CRON_SECRET. Also accepts ?secret= for local tests.
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Allow in development so local curls work without env.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") === secret) return true;
  } catch {
    /* ignore */
  }
  return false;
}
