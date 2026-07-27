export function createId(prefix?: string) {
  const id = crypto.randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${id}` : id;
}

export function bookingReference() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SH-${part}`;
}

/** Opaque token so guests can open their receipt without logging in. */
export function bookingAccessToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
