import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import {
  listProvidersForUser,
  requireApprovedProviderAccess,
  requireProviderAccess,
} from "@/lib/provider";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import {
  normalizeEmail,
  validateKenyanPhone,
} from "@/lib/identity";
import {
  isStaffRole,
  normalizeStaffRole,
  roleCatalog,
  staffCanManageTeam,
  type StaffRole,
} from "@/lib/staff-roles";
import {
  boolSetting,
  getPlatformSettings,
  numberSetting,
} from "@/lib/settings";

async function staffingDisabledResponse() {
  const settings = await getPlatformSettings();
  if (!boolSetting(settings, "flags.staffingEnabled")) {
    return jsonError("Staffing is currently disabled", 403);
  }
  return null;
}

type ManageableBiz = {
  id: string;
  name: string;
  slug: string;
  isApproved: boolean;
  myRole: string;
};

async function manageableBusinesses(userId: string): Promise<ManageableBiz[]> {
  const memberships = await listProvidersForUser(userId);
  return memberships
    .filter((m) => staffCanManageTeam(m.role))
    .map((m) => ({
      id: m.provider.id,
      name: m.provider.name,
      slug: m.provider.slug,
      isApproved: Boolean(m.provider.isApproved),
      myRole: m.role,
    }));
}

async function assertCanManageProviders(
  userId: string,
  providerIds: string[],
): Promise<ManageableBiz[]> {
  const manageable = await manageableBusinesses(userId);
  const byId = new Map(manageable.map((b) => [b.id, b]));
  const selected: ManageableBiz[] = [];
  for (const id of providerIds) {
    const biz = byId.get(id);
    if (!biz) {
      throw new Error("FORBIDDEN");
    }
    if (!biz.isApproved) {
      throw new Error("PROVIDER_NOT_APPROVED");
    }
    selected.push(biz);
  }
  return selected;
}

export async function GET() {
  try {
    const disabled = await staffingDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    const canManage = staffCanManageTeam(access.role);
    const businesses = await manageableBusinesses(session.user.id);
    const approvedManageable = businesses.filter((b) => b.isApproved);

    if (!canManage) {
      return jsonOk({
        canManage: false,
        myRole: access.role,
        roles: roleCatalog(),
        businesses: [],
        members: [],
        message: "Only owners and managers can register staff.",
      });
    }

    const providerIds = businesses.map((b) => b.id);
    if (providerIds.length === 0) {
      return jsonOk({
        canManage: true,
        myRole: access.role,
        roles: roleCatalog(),
        businesses,
        members: [],
      });
    }

    const { data: members, error } = await db
      .from("ProviderMember")
      .select(
        "id, role, providerId, user:User(id, name, email, phone), provider:Provider(id, name, slug, isApproved)",
      )
      .in("providerId", providerIds)
      .order("role", { ascending: true });
    if (error) throw error;

    return jsonOk({
      canManage: true,
      myRole: access.role,
      roles: roleCatalog(),
      businesses,
      assignableBusinesses: approvedManageable,
      members: (members ?? []).map((m) => {
        const row = m as unknown as {
          id: string;
          role: string;
          providerId: string;
          user:
            | { id: string; name: string | null; email: string; phone: string | null }
            | { id: string; name: string | null; email: string; phone: string | null }[]
            | null;
          provider:
            | { id: string; name: string; slug: string; isApproved: boolean }
            | { id: string; name: string; slug: string; isApproved: boolean }[]
            | null;
        };
        const user = Array.isArray(row.user) ? row.user[0] : row.user;
        const provider = Array.isArray(row.provider)
          ? row.provider[0]
          : row.provider;
        return {
          id: row.id,
          role: row.role,
          providerId: row.providerId,
          user,
          provider,
        };
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Register a staff account (or attach an existing PROVIDER user) and assign
 * them to one or more approved businesses you own/manage.
 */
export async function POST(req: Request) {
  try {
    const disabled = await staffingDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    // Active business must be approved to open staffing operations
    await requireApprovedProviderAccess(session.user.id);

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = normalizeEmail(String(body.email || ""));
    const password = String(body.password || "");
    const roleRaw = String(body.role || "FRONT_DESK").toUpperCase();
    const providerIds = Array.isArray(body.providerIds)
      ? ([...new Set(body.providerIds.map(String))] as string[])
      : [];

    if (!email || !email.includes("@")) {
      return jsonError("Valid email is required");
    }
    if (!isStaffRole(roleRaw)) {
      return jsonError("Invalid staff role");
    }
    const role = roleRaw as StaffRole;
    if (providerIds.length === 0) {
      return jsonError("Select at least one business to assign");
    }

    const targets = await assertCanManageProviders(session.user.id, providerIds);

    // Only owners may grant OWNER
    const actorMemberships = await listProvidersForUser(session.user.id);
    if (role === "OWNER") {
      const notOwnerOf = targets.filter((t) => {
        const mine = actorMemberships.find((m) => m.provider.id === t.id);
        return normalizeStaffRole(mine?.role) !== "OWNER";
      });
      if (notOwnerOf.length) {
        return jsonError("Only an owner can assign the Owner role");
      }
    }

    const phoneResult = validateKenyanPhone(body.phone, { required: false });
    if (phoneResult.error) return jsonError(phoneResult.error, 400);
    const phone = phoneResult.phone;

    const settings = await getPlatformSettings();
    const minLen = numberSetting(settings, "security.minPasswordLength") || 6;

    let userId: string;
    let created = false;
    let userName: string | null = name || null;

    const { data: existingUser } = await db
      .from("User")
      .select("id, email, name, role, phone")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.role === "ADMIN") {
        return jsonError("Cannot add an admin account as staff");
      }
      if (existingUser.role === "TOURIST") {
        // Promote tourist → provider staff (they keep the same login)
        const { error: promoteErr } = await db
          .from("User")
          .update({
            role: "PROVIDER",
            name: name || existingUser.name,
            phone: phone || existingUser.phone,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", existingUser.id);
        if (promoteErr) throw promoteErr;
      } else if (name && name !== existingUser.name) {
        await db
          .from("User")
          .update({ name, updatedAt: new Date().toISOString() })
          .eq("id", existingUser.id);
      }
      userId = existingUser.id;
      userName = name || existingUser.name;
    } else {
      if (!name || name.length < 2) {
        return jsonError("Staff name is required (min 2 characters)");
      }
      if (password.length < minLen) {
        return jsonError(`Password must be at least ${minLen} characters`);
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      userId = createId();
      const { error: userError } = await db.from("User").insert({
        id: userId,
        name,
        email,
        phone,
        passwordHash,
        role: "PROVIDER",
        createdAt: now,
        updatedAt: now,
      });
      if (userError) {
        if (String(userError.message || "").toLowerCase().includes("email")) {
          return jsonError("An account with this email already exists", 409);
        }
        throw userError;
      }
      created = true;
      userName = name;
    }

    const assigned: { providerId: string; name: string; role: string }[] = [];
    const skipped: string[] = [];

    for (const biz of targets) {
      const { data: already } = await db
        .from("ProviderMember")
        .select("id, role")
        .eq("providerId", biz.id)
        .eq("userId", userId)
        .maybeSingle();
      if (already) {
        skipped.push(biz.name);
        continue;
      }
      const { error } = await db.from("ProviderMember").insert({
        id: createId("pm"),
        providerId: biz.id,
        userId,
        role,
      });
      if (error) throw error;
      assigned.push({ providerId: biz.id, name: biz.name, role });
    }

    if (assigned.length === 0) {
      return jsonError(
        skipped.length
          ? "This person is already on every selected business"
          : "Could not assign staff",
      );
    }

    const loginHint = created
      ? ` They can sign in with ${email} and the password you set.`
      : ` Existing account linked — they sign in with ${email}.`;

    return jsonOk({
      created,
      user: { id: userId, name: userName, email },
      assigned,
      skipped,
      message: `${userName || email} registered as ${role.replace("_", " ")} on ${assigned.map((a) => a.name).join(", ")}.${loginHint}`,
    });
  } catch (error) {
    console.error("Staff API POST error:", error);
    return handleRouteError(error);
  }
}

/** Update a member's role on a business. */
export async function PATCH(req: Request) {
  try {
    const disabled = await staffingDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    await requireApprovedProviderAccess(session.user.id);

    const body = await req.json();
    const memberId = String(body.memberId || "");
    const roleRaw = String(body.role || "").toUpperCase();
    if (!memberId) return jsonError("memberId is required");
    if (!isStaffRole(roleRaw)) return jsonError("Invalid staff role");
    const role = roleRaw as StaffRole;

    const { data: member, error } = await db
      .from("ProviderMember")
      .select("id, userId, providerId, role")
      .eq("id", memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member) return jsonError("Member not found", 404);

    await assertCanManageProviders(session.user.id, [member.providerId]);

    if (role === "OWNER") {
      const mine = (await listProvidersForUser(session.user.id)).find(
        (m) => m.provider.id === member.providerId,
      );
      if (normalizeStaffRole(mine?.role) !== "OWNER") {
        return jsonError("Only an owner can assign the Owner role");
      }
    }

    // Don't demote the last owner
    if (
      normalizeStaffRole(member.role) === "OWNER" &&
      role !== "OWNER"
    ) {
      const { count } = await db
        .from("ProviderMember")
        .select("id", { count: "exact", head: true })
        .eq("providerId", member.providerId)
        .eq("role", "OWNER");
      if ((count ?? 0) <= 1) {
        return jsonError("Each business needs at least one owner");
      }
    }

    const { error: updErr } = await db
      .from("ProviderMember")
      .update({ role })
      .eq("id", memberId);
    if (updErr) throw updErr;

    return jsonOk({ ok: true, memberId, role });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Remove staff from a business. */
export async function DELETE(req: Request) {
  try {
    const disabled = await staffingDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    await requireApprovedProviderAccess(session.user.id);

    const url = new URL(req.url);
    const memberId =
      url.searchParams.get("memberId") ||
      String((await req.json().catch(() => ({}))).memberId || "");
    if (!memberId) return jsonError("memberId is required");

    const { data: member, error } = await db
      .from("ProviderMember")
      .select("id, userId, providerId, role")
      .eq("id", memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member) return jsonError("Member not found", 404);

    await assertCanManageProviders(session.user.id, [member.providerId]);

    if (member.userId === session.user.id) {
      return jsonError("You cannot remove yourself");
    }

    if (normalizeStaffRole(member.role) === "OWNER") {
      const { count } = await db
        .from("ProviderMember")
        .select("id", { count: "exact", head: true })
        .eq("providerId", member.providerId)
        .eq("role", "OWNER");
      if ((count ?? 0) <= 1) {
        return jsonError("Each business needs at least one owner");
      }
    }

    const { error: delErr } = await db
      .from("ProviderMember")
      .delete()
      .eq("id", memberId);
    if (delErr) throw delErr;

    return jsonOk({ ok: true, removed: memberId });
  } catch (error) {
    return handleRouteError(error);
  }
}
