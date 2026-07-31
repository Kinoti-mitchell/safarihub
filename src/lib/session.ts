import { auth } from "@/lib/auth";
import { type Permission } from "@/lib/rbac";
import { userHasPermission } from "@/lib/role-store";
import type { Role } from "@/lib/roles";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Any authenticated user who holds the given permission (DB-backed). */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!(await userHasPermission(user, permission))) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/**
 * Admin console APIs: caller must have base role ADMIN.
 * All admins have full rights — permission argument is kept for call-site
 * clarity / future audit, but is not used to deny access.
 */
export async function requireAdminPermission(_permission: Permission) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
