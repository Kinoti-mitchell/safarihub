/** Provider-scoped staff roles (not the global User Role enum). */

export const STAFF_ROLES = [
  "OWNER",
  "MANAGER",
  "FRONT_DESK",
  "ACCOUNTANT",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffPermission =
  | "hub"
  | "bookings"
  | "inbox"
  | "reviews"
  | "listings"
  | "staff"
  | "suppliers"
  | "inventory"
  | "compliance"
  | "payouts"
  | "insights"
  | "business_profile"
  | "businesses"
  | "account";

const ALL_PERMS: StaffPermission[] = [
  "hub",
  "bookings",
  "inbox",
  "reviews",
  "listings",
  "staff",
  "suppliers",
  "inventory",
  "compliance",
  "payouts",
  "insights",
  "business_profile",
  "businesses",
  "account",
];

export type StaffRoleMeta = {
  key: StaffRole;
  label: string;
  summary: string;
  permissions: StaffPermission[];
  /** Can create staff accounts and assign them to businesses. */
  canManageStaff: boolean;
};

export const STAFF_ROLE_META: Record<StaffRole, StaffRoleMeta> = {
  OWNER: {
    key: "OWNER",
    label: "Owner",
    summary: "Full control — businesses, staff, money, and settings.",
    permissions: ALL_PERMS,
    canManageStaff: true,
  },
  MANAGER: {
    key: "MANAGER",
    label: "Manager / ICT",
    summary:
      "Run operations and register staff across businesses you manage.",
    permissions: [
      "hub",
      "bookings",
      "inbox",
      "reviews",
      "listings",
      "staff",
      "suppliers",
      "inventory",
      "compliance",
      "insights",
      "business_profile",
      "businesses",
      "account",
    ],
    canManageStaff: true,
  },
  FRONT_DESK: {
    key: "FRONT_DESK",
    label: "Front desk",
    summary: "Guest bookings, inbox and reviews — day-to-day desk work.",
    permissions: ["hub", "bookings", "inbox", "reviews", "account"],
    canManageStaff: false,
  },
  ACCOUNTANT: {
    key: "ACCOUNTANT",
    label: "Accountant",
    summary: "Payouts, insights, inventory counts and booking records.",
    permissions: [
      "hub",
      "bookings",
      "inventory",
      "payouts",
      "insights",
      "account",
    ],
    canManageStaff: false,
  },
};

const PATH_PERMISSION: Array<{ prefix: string; permission: StaffPermission }> =
  [
    { prefix: "/provider/bookings", permission: "bookings" },
    { prefix: "/provider/inbox", permission: "inbox" },
    { prefix: "/provider/inquiries", permission: "inbox" },
    { prefix: "/provider/reviews", permission: "reviews" },
    { prefix: "/provider/listings", permission: "listings" },
    { prefix: "/provider/staff", permission: "staff" },
    { prefix: "/provider/suppliers", permission: "suppliers" },
    { prefix: "/provider/inventory", permission: "inventory" },
    { prefix: "/provider/compliance", permission: "compliance" },
    { prefix: "/provider/payouts", permission: "payouts" },
    { prefix: "/provider/analytics", permission: "insights" },
    { prefix: "/provider/businesses", permission: "businesses" },
    { prefix: "/provider/business", permission: "business_profile" },
    { prefix: "/provider/profile", permission: "account" },
    { prefix: "/provider", permission: "hub" },
  ];

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function normalizeStaffRole(value: string | null | undefined): StaffRole {
  const upper = String(value || "FRONT_DESK").toUpperCase();
  return isStaffRole(upper) ? upper : "FRONT_DESK";
}

export function staffCanManageTeam(role: string): boolean {
  const meta = STAFF_ROLE_META[normalizeStaffRole(role)];
  return meta.canManageStaff;
}

export function staffHasPermission(
  role: string,
  permission: StaffPermission,
): boolean {
  return STAFF_ROLE_META[normalizeStaffRole(role)].permissions.includes(
    permission,
  );
}

/** Longest-prefix match so /provider does not swallow /provider/bookings. */
export function staffCanAccessPath(role: string, pathname: string): boolean {
  const path = pathname.split("?")[0] || "/provider";
  if (path === "/provider" || path === "/provider/") {
    return staffHasPermission(role, "hub");
  }
  const match = PATH_PERMISSION.filter(
    (p) =>
      p.prefix !== "/provider" &&
      (path === p.prefix || path.startsWith(`${p.prefix}/`)),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return staffHasPermission(role, "hub");
  return staffHasPermission(role, match.permission);
}

export function roleCatalog() {
  return STAFF_ROLES.map((key) => ({
    key,
    label: STAFF_ROLE_META[key].label,
    summary: STAFF_ROLE_META[key].summary,
    canManageStaff: STAFF_ROLE_META[key].canManageStaff,
    permissions: STAFF_ROLE_META[key].permissions,
  }));
}
