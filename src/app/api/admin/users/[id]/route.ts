import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getRoleDefinition } from "@/lib/role-store";
import type { Role } from "@/lib/roles";
import {
  findIdentityClash,
  normalizeEmail,
  validateKenyanPhone,
} from "@/lib/identity";

type Params = { params: Promise<{ id: string }> };

const schema = z
  .object({
    role: z.enum(["ADMIN", "TOURIST", "PROVIDER"]).optional(),
    roleKey: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1, "Name is required").optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Nothing to update",
  });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("user.manage");
    const { id } = await params;
    const input = schema.parse(await request.json());

    const { data: existing } = await db
      .from("User")
      .select("id, name, email, phone, role, roleKey")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return jsonError("User not found", 404);

    const data: Record<string, unknown> = {};
    const changes: string[] = [];

    let targetRole: Role | undefined;
    let targetRoleKey: string | null | undefined;
    if (input.roleKey !== undefined) {
      const def = await getRoleDefinition(input.roleKey);
      if (!def) return jsonError("Unknown role", 400);
      targetRole = def.baseRole;
      targetRoleKey = def.isSystem ? null : def.key;
    } else if (input.role !== undefined) {
      targetRole = input.role;
      targetRoleKey = null;
    }

    if (targetRole !== undefined) {
      const roleChanging =
        targetRole !== existing.role ||
        (targetRoleKey ?? null) !== (existing.roleKey ?? null);
      if (roleChanging) {
        if (id === admin.id) {
          return jsonError("You cannot change your own role", 400);
        }
        if (existing.role === "ADMIN" && targetRole !== "ADMIN") {
          const { count: adminCount } = await db
            .from("User")
            .select("id", { count: "exact", head: true })
            .eq("role", "ADMIN")
            .is("roleKey", null);
          if ((adminCount ?? 0) <= 1) {
            return jsonError("Cannot demote the last remaining admin", 400);
          }
        }
        data.role = targetRole;
        data.roleKey = targetRoleKey ?? null;
        const from = existing.roleKey || existing.role;
        const to = targetRoleKey || targetRole;
        changes.push(`role ${from} → ${to}`);
      }
    }

    if (input.email) {
      const email = normalizeEmail(input.email);
      if (email !== existing.email) {
        const clash = await findIdentityClash({ email, excludeUserId: id });
        if (clash) return jsonError(clash.message, 409);
        data.email = email;
        changes.push("email");
      }
    }

    if (input.name && input.name !== existing.name) {
      data.name = input.name;
      changes.push("name");
    }

    if (input.phone !== undefined) {
      const phoneResult = validateKenyanPhone(input.phone);
      if (phoneResult.error) return jsonError(phoneResult.error, 400);
      const phone = phoneResult.phone;
      const existingNorm = validateKenyanPhone(existing.phone).phone;
      if (phone !== existingNorm) {
        if (phone) {
          const clash = await findIdentityClash({ phone, excludeUserId: id });
          if (clash) return jsonError(clash.message, 409);
        }
        data.phone = phone;
        changes.push("phone");
      }
    }

    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
      changes.push("password");
    }

    if (changes.length === 0) {
      return jsonOk({ user: existing, unchanged: true });
    }
    data.updatedAt = new Date().toISOString();

    const { data: updatedUser, error } = await db
      .from("User")
      .update(data)
      .eq("id", id)
      .select(
        "id, name, email, phone, role, roleKey, createdAt, bookings:Booking(count)",
      )
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("unique")) {
        return jsonError("That email or phone is already in use", 409);
      }
      throw error;
    }
    const { bookings, ...userRest } = updatedUser as unknown as Record<
      string,
      unknown
    > & { bookings?: Array<{ count: number }> };
    const user = {
      ...userRest,
      _count: { bookings: bookings?.[0]?.count ?? 0 },
    } as {
      id: string;
      email: string;
      _count: { bookings: number };
    } & Record<string, unknown>;

    const roleChanged = changes.some((c) => c.startsWith("role "));
    await logAudit({
      actor: admin,
      action:
        roleChanged && changes.length === 1 ? "user.role.change" : "user.update",
      entityType: "User",
      entityId: user.id,
      summary: `Updated ${user.email}: ${changes.join(", ")}`,
      metadata: { changes },
    });

    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
