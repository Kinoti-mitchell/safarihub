/**
 * Ensure Auth.js has a correct public URL on Vercel.
 * A leftover AUTH_URL / NEXT_PUBLIC_APP_URL of localhost breaks session cookies
 * and makes API routes return 401 while the UI still looks signed in.
 */
export function ensureAuthUrl() {
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  const configured =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";

  const isLocal = (value: string) =>
    /localhost|127\.0\.0\.1/i.test(value) || value.startsWith("http://");

  if (process.env.VERCEL && vercelHost) {
    if (!configured || isLocal(configured)) {
      process.env.AUTH_URL = `https://${vercelHost.replace(/^https?:\/\//, "")}`;
    }
    return;
  }

  if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL && configured) {
    process.env.AUTH_URL = configured;
  }
}
