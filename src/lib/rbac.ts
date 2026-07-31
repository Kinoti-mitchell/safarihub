import type { Role } from "@/lib/roles";

/**
 * Built-in permission defaults for the three system roles. These seed the
 * DB-backed `RoleDefinition` table (the runtime source of truth) and act as a
 * fallback if the database is unavailable. Editing a role's permissions in the
 * admin console updates the DB — not this file.
 *
 * The built-in ADMIN role always has every permission (enforced in code and
 * locked in the Roles UI / API).
 */
export const PERMISSIONS = {
  "listing.create": ["PROVIDER", "ADMIN"],
  "listing.edit": ["PROVIDER", "ADMIN"],
  "listing.publish": ["ADMIN"],
  "inventory.manage": ["PROVIDER", "ADMIN"],
  "pricing.manage": ["PROVIDER", "ADMIN"],
  "booking.create": ["TOURIST", "ADMIN"],
  "booking.confirm": ["PROVIDER", "ADMIN"],
  "booking.cancel": ["TOURIST", "PROVIDER", "ADMIN"],
  "review.create": ["TOURIST", "ADMIN"],
  "review.reply": ["PROVIDER", "ADMIN"],
  "review.moderate": ["ADMIN"],
  "user.manage": ["ADMIN"],
  "role.manage": ["ADMIN"],
  "market.manage": ["ADMIN"],
  "content.manage": ["ADMIN"],
  "announcement.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "supplier.manage": ["ADMIN"],
  "logs.view": ["ADMIN"],
  "analytics.view.own": ["PROVIDER", "ADMIN"],
  "analytics.view.all": ["ADMIN"],
  "payout.view": ["PROVIDER", "ADMIN"],
  "payout.manage": ["ADMIN"],
  "boost.manage": ["ADMIN"],
  "inquiry.manage": ["PROVIDER", "ADMIN"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Human-readable catalog of every permission, grouped by module. Drives the
 * permission matrix UI so it reads clearly instead of exposing raw keys.
 */
export type PermissionGroup = {
  group: string;
  items: { key: Permission; label: string }[];
};

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    group: "Listings",
    items: [
      { key: "listing.create", label: "Create listings" },
      { key: "listing.edit", label: "Edit listings" },
      { key: "listing.publish", label: "Publish / approve listings" },
      { key: "inventory.manage", label: "Manage rooms & inventory" },
      { key: "pricing.manage", label: "Manage pricing" },
    ],
  },
  {
    group: "Bookings",
    items: [
      { key: "booking.create", label: "Create bookings" },
      { key: "booking.confirm", label: "Confirm bookings" },
      { key: "booking.cancel", label: "Cancel bookings" },
    ],
  },
  {
    group: "Reviews & inquiries",
    items: [
      { key: "review.create", label: "Leave reviews" },
      { key: "review.reply", label: "Reply to reviews" },
      { key: "review.moderate", label: "Moderate reviews" },
      { key: "inquiry.manage", label: "Manage inquiries" },
    ],
  },
  {
    group: "Finance",
    items: [
      { key: "payout.view", label: "View payouts" },
      { key: "payout.manage", label: "Manage payouts" },
      { key: "boost.manage", label: "Manage listing boosts" },
      { key: "supplier.manage", label: "Manage suppliers" },
    ],
  },
  {
    group: "Analytics",
    items: [
      { key: "analytics.view.own", label: "View own analytics" },
      { key: "analytics.view.all", label: "View platform analytics" },
      { key: "logs.view", label: "View activity logs" },
    ],
  },
  {
    group: "Administration",
    items: [
      { key: "user.manage", label: "Manage users" },
      { key: "role.manage", label: "Manage roles & permissions" },
      { key: "market.manage", label: "Manage markets" },
      { key: "content.manage", label: "Manage events & packages" },
      { key: "announcement.manage", label: "Push ads & broadcasts" },
      { key: "settings.manage", label: "Manage platform settings" },
    ],
  },
];

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function permissionLabel(key: string): string {
  for (const group of PERMISSION_CATALOG) {
    const found = group.items.find((i) => i.key === key);
    if (found) return found.label;
  }
  return key;
}

/** Default permission keys granted to a built-in role. */
export function defaultPermissionsForRole(role: Role): Permission[] {
  if (role === "ADMIN") return [...ALL_PERMISSIONS];
  return ALL_PERMISSIONS.filter((p) =>
    (PERMISSIONS[p] as readonly string[]).includes(role),
  );
}

/**
 * Platform admins always have every right — including users whose roleKey is a
 * custom staff role. If base role is ADMIN, permissions are never restricted.
 */
export function isBuiltInAdmin(user: {
  role: Role;
  roleKey?: string | null;
}): boolean {
  return user.role === "ADMIN";
}

/** Static fallback check against built-in defaults (DB overrides at runtime). */
export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

export function isProviderRole(role: Role): boolean {
  return role === "PROVIDER";
}

export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PROVIDER":
      return "/provider";
    case "TOURIST":
    default:
      return "/account";
  }
}
