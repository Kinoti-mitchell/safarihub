/** Allow only same-origin relative paths for post-login redirects. */
export function safeReturnUrl(
  raw: string | null | undefined,
  fallback = "/account",
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}
