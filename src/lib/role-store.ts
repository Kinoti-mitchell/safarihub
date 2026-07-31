import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { ROLES, ROLE_LABEL, ROLE_DESC, type Role } from "@/lib/roles";
import {
  ALL_PERMISSIONS,
  defaultPermissionsForRole,
  isBuiltInAdmin,
  hasPermission,
  type Permission,
} from "@/lib/rbac";

type RoleRow = {
  key: string;
  label: string;
  description: string | null;
  baseRole: Role;
  isSystem: boolean;
  permissions: unknown;
};

export type RoleDefinitionView = {
  key: string;
  label: string;
  description: string | null;
  baseRole: Role;
  isSystem: boolean;
  permissions: Permission[];
};

export type PermissionUser = {
  role: Role;
  roleKey?: string | null;
};

let seeded = false;

/** Idempotently create the three built-in role definitions if missing. */
export async function ensureRolesSeeded(): Promise<void> {
  if (seeded) {
    await ensureAdminFullPermissions();
    return;
  }
  const { data: existing, error } = await db
    .from("RoleDefinition")
    .select("key");
  if (error) throw new Error(error.message);
  const have = new Set((existing ?? []).map((r) => r.key as string));
  const missing = ROLES.filter((r) => !have.has(r));
  if (missing.length) {
    const now = new Date().toISOString();
    const rows = missing.map((role) => ({
      id: createId(),
      key: role,
      label: ROLE_LABEL[role],
      description: ROLE_DESC[role],
      baseRole: role,
      isSystem: true,
      permissions: defaultPermissionsForRole(role),
      updatedAt: now,
    }));
    const { error: insertError } = await db.from("RoleDefinition").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
  await ensureAdminFullPermissions();
  seeded = true;
}

/** Keep the built-in ADMIN matrix at full rights (new perms + cannot strip). */
export async function ensureAdminFullPermissions(): Promise<void> {
  const { data: admin } = await db
    .from("RoleDefinition")
    .select("key, permissions")
    .eq("key", "ADMIN")
    .maybeSingle();
  if (!admin) return;

  const current = sanitizePermissions(admin.permissions);
  const missing = ALL_PERMISSIONS.filter((p) => !current.includes(p));
  if (missing.length === 0 && current.length === ALL_PERMISSIONS.length) return;

  const { error } = await db
    .from("RoleDefinition")
    .update({
      permissions: [...ALL_PERMISSIONS],
      updatedAt: new Date().toISOString(),
    })
    .eq("key", "ADMIN");
  if (error) throw new Error(error.message);
}

function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set<string>(ALL_PERMISSIONS);
  return input.filter(
    (p): p is Permission => typeof p === "string" && valid.has(p),
  );
}

export async function listRoleDefinitions(): Promise<RoleDefinitionView[]> {
  await ensureRolesSeeded();
  const { data: roles, error } = await db
    .from("RoleDefinition")
    .select("key, label, description, baseRole, isSystem, permissions")
    .order("isSystem", { ascending: false })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return ((roles ?? []) as RoleRow[]).map((r) => toRoleView(r));
}

export async function getRoleDefinition(
  key: string,
): Promise<RoleDefinitionView | null> {
  await ensureRolesSeeded();
  const { data: r } = await db
    .from("RoleDefinition")
    .select("key, label, description, baseRole, isSystem, permissions")
    .eq("key", key)
    .maybeSingle();
  if (!r) return null;
  return toRoleView(r as RoleRow);
}

function toRoleView(row: RoleRow): RoleDefinitionView {
  const permissions =
    row.key === "ADMIN"
      ? [...ALL_PERMISSIONS]
      : sanitizePermissions(row.permissions);
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    baseRole: row.baseRole,
    isSystem: row.isSystem,
    permissions,
  };
}

/**
 * Runtime permission check. Every ADMIN always passes (full rights).
 * Everyone else is checked against RoleDefinition (roleKey, then role),
 * with static defaults as fallback when the definition is missing.
 */
export async function userHasPermission(
  user: PermissionUser,
  permission: Permission,
): Promise<boolean> {
  // All platform admins have every permission — never gate on roleKey matrix.
  if (user.role === "ADMIN" || isBuiltInAdmin(user)) return true;

  const key = user.roleKey || user.role;
  try {
    const def = await getRoleDefinition(key);
    if (def) {
      if (def.key === "ADMIN" || def.baseRole === "ADMIN") return true;
      return def.permissions.includes(permission);
    }
  } catch {
    // Fall through to static defaults if RoleDefinition is unavailable.
  }
  return hasPermission(user.role, permission);
}

/** Turn a display name into a stable, unique-ish custom role key. */
export function slugifyRoleKey(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "role"
  );
}

export { sanitizePermissions };
