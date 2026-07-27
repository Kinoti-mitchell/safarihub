import { z } from "zod";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import {
  ensureRolesSeeded,
  listRoleDefinitions,
  slugifyRoleKey,
  sanitizePermissions,
} from "@/lib/role-store";
import { PERMISSION_CATALOG } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";
import { requireAdminPermission } from "@/lib/session";

const createSchema = z.object({
  label: z.string().trim().min(2, "Name is required").max(40),
  description: z.string().trim().max(200).optional(),
  baseRole: z.enum(["ADMIN", "PROVIDER", "TOURIST"]).default("TOURIST"),
  permissions: z.array(z.string()).default([]),
});

async function roleUserCounts() {
  const { data, error } = await db.from("User").select("role, roleKey");
  if (error) throw error;
  const rows = (data ?? []) as Array<{ role: string; roleKey: string | null }>;
  const counts: Record<string, number> = {};
  for (const u of rows) {
    // Custom roles are keyed by roleKey; built-in users (no roleKey) by role.
    const key = u.roleKey ?? u.role;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export async function GET() {
  try {
    await requireAdminPermission("role.manage");
    await ensureRolesSeeded();
    const [roles, userCounts] = await Promise.all([
      listRoleDefinitions(),
      roleUserCounts(),
    ]);
    return jsonOk({ roles, catalog: PERMISSION_CATALOG, userCounts });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("role.manage");
    await ensureRolesSeeded();
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const { label, description, baseRole, permissions } = parsed.data;

    // Derive a unique key from the label.
    let base = slugifyRoleKey(label);
    if ((ROLES as readonly string[]).includes(base.toUpperCase())) {
      base = `${base}_role`;
    }
    let key = base;
    let n = 1;
    // Find a free key.
    for (;;) {
      const { data: clash } = await db
        .from("RoleDefinition")
        .select("key")
        .eq("key", key)
        .maybeSingle();
      if (!clash) break;
      key = `${base}_${n++}`;
    }

    const now = new Date().toISOString();
    const { data: role, error } = await db
      .from("RoleDefinition")
      .insert({
        id: createId(),
        key,
        label,
        description: description || null,
        baseRole,
        isSystem: false,
        permissions: sanitizePermissions(permissions),
        updatedAt: now,
      })
      .select("key")
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "role.create",
      entityType: "RoleDefinition",
      entityId: role.key,
      summary: `Created role "${label}" (base ${baseRole})`,
    });

    return jsonOk({ role: { key: role.key } }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
