import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { ensureRolesSeeded, sanitizePermissions } from "@/lib/role-store";
import { ALL_PERMISSIONS } from "@/lib/rbac";
import { requireAdminPermission } from "@/lib/session";

type Params = { params: Promise<{ key: string }> };

const patchSchema = z
  .object({
    label: z.string().trim().min(2).max(40).optional(),
    description: z.string().trim().max(200).nullable().optional(),
    permissions: z.array(z.string()).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Nothing to update",
  });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("role.manage");
    await ensureRolesSeeded();
    const { key } = await params;

    const { data: existing } = await db
      .from("RoleDefinition")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (!existing) return jsonError("Role not found", 404);

    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const input = parsed.data;

    const data: {
      label?: string;
      description?: string | null;
      permissions?: string[];
      updatedAt?: string;
    } = {};
    // System roles keep their name/description locked, but permissions stay editable
    // — except the built-in ADMIN role, which always keeps every permission.
    if (!existing.isSystem) {
      if (input.label !== undefined) data.label = input.label;
      if (input.description !== undefined) data.description = input.description;
    }
    if (input.permissions !== undefined) {
      if (key === "ADMIN") {
        data.permissions = [...ALL_PERMISSIONS];
      } else {
        data.permissions = sanitizePermissions(input.permissions);
      }
    }

    if (Object.keys(data).length === 0) {
      return jsonOk({ role: { key }, unchanged: true });
    }
    data.updatedAt = new Date().toISOString();

    const { data: role, error } = await db
      .from("RoleDefinition")
      .update(data)
      .eq("key", key)
      .select("key, label")
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "role.update",
      entityType: "RoleDefinition",
      entityId: key,
      summary: `Updated permissions for role "${role.label}"`,
    });

    return jsonOk({ role: { key: role.key } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("role.manage");
    await ensureRolesSeeded();
    const { key } = await params;

    const { data: existing } = await db
      .from("RoleDefinition")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (!existing) return jsonError("Role not found", 404);
    if (existing.isSystem) {
      return jsonError("Built-in roles cannot be deleted", 400);
    }

    const { count } = await db
      .from("User")
      .select("id", { count: "exact", head: true })
      .eq("roleKey", key);
    const inUse = count ?? 0;
    if (inUse > 0) {
      return jsonError(
        `This role is assigned to ${inUse} user${inUse === 1 ? "" : "s"}. Reassign them first.`,
        400,
      );
    }

    const { error: deleteError } = await db
      .from("RoleDefinition")
      .delete()
      .eq("key", key);
    if (deleteError) throw deleteError;
    await logAudit({
      actor: admin,
      action: "role.delete",
      entityType: "RoleDefinition",
      entityId: key,
      summary: `Deleted role "${existing.label}"`,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
