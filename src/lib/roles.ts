/** Platform roles. Source of truth (matches the "Role" enum in the database). */
export type Role = "ADMIN" | "PROVIDER" | "TOURIST";

export const ROLES = ["ADMIN", "PROVIDER", "TOURIST"] as const satisfies readonly Role[];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROVIDER: "Provider",
  TOURIST: "Tourist",
};

export const ROLE_DESC: Record<Role, string> = {
  ADMIN: "System owner — full platform control and moderation.",
  PROVIDER: "Hotel / venue owner managing listings, bookings and payouts.",
  TOURIST: "Guest who discovers places, books stays and leaves reviews.",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
