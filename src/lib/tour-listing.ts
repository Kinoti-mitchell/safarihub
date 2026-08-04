/** Helpers for tour / safari listing fields. */

export function parseBulletList(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0)
      .slice(0, 40);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parseBulletList(parsed);
    } catch {
      /* treat as newline / comma list */
    }
    return raw
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .slice(0, 40);
  }
  return [];
}

export function bulletsToTextarea(items: unknown): string {
  return parseBulletList(items).join("\n");
}

export function formatTourDuration(listing: {
  durationDays?: number | null;
  durationHours?: number | null;
}): string | null {
  const days = listing.durationDays;
  const hours = listing.durationHours;
  const parts: string[] = [];
  if (days != null && days > 0) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }
  if (hours != null && hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function isTourCategories(categories: string[]): boolean {
  return categories.some((c) => c === "EXPLORE" || c === "MOVE");
}
