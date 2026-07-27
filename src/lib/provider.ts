import { cookies } from "next/headers";
import { db } from "@/lib/supabase";

export const ACTIVE_PROVIDER_COOKIE = "safari_hub_provider";

export type ProviderRecord = {
  id: string;
  slug: string;
  name: string;
  isApproved?: boolean;
} & Record<string, unknown>;

export type ProviderAccess = {
  membership: { id: string; role: string; providerId: string };
  provider: ProviderRecord;
  role: string;
};

export type ProviderMembershipRow = {
  id: string;
  role: string;
  provider: ProviderRecord;
};

async function readPreferredProviderId(
  explicit?: string | null,
): Promise<string | undefined> {
  if (explicit) return explicit;
  try {
    const jar = await cookies();
    return jar.get(ACTIVE_PROVIDER_COOKIE)?.value || undefined;
  } catch {
    return undefined;
  }
}

/** All businesses this user can manage. */
export async function listProvidersForUser(
  userId: string,
): Promise<ProviderMembershipRow[]> {
  const { data, error } = await db
    .from("ProviderMember")
    .select("id, role, provider:Provider(*)")
    .eq("userId", userId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{
    id: string;
    role: string;
    provider: ProviderRecord | ProviderRecord[] | null;
  }>)
    .map((row) => {
      const provider = Array.isArray(row.provider)
        ? row.provider[0]
        : row.provider;
      if (!provider) return null;
      return {
        id: row.id,
        role: row.role,
        provider,
      };
    })
    .filter((x): x is ProviderMembershipRow => Boolean(x))
    .sort((a, b) => a.provider.name.localeCompare(b.provider.name));
}

/** True if user is a member of this business. */
export async function userCanAccessProvider(
  userId: string,
  providerId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("ProviderMember")
    .select("id")
    .eq("userId", userId)
    .eq("providerId", providerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Active business for this user.
 * Prefer explicit id, then cookie, then first membership.
 */
export async function getProviderForUser(
  userId: string,
  preferredProviderId?: string | null,
): Promise<ProviderAccess | null> {
  const memberships = await listProvidersForUser(userId);
  if (!memberships.length) return null;

  const preferred = await readPreferredProviderId(preferredProviderId);
  const chosen =
    (preferred &&
      memberships.find((m) => m.provider.id === preferred)) ||
    memberships[0];

  return {
    membership: {
      id: chosen.id,
      role: chosen.role,
      providerId: chosen.provider.id,
    },
    provider: chosen.provider,
    role: chosen.role,
  };
}

export async function requireProviderAccess(
  userId: string,
  preferredProviderId?: string | null,
) {
  const access = await getProviderForUser(userId, preferredProviderId);
  if (!access) throw new Error("FORBIDDEN");
  return access;
}

/** Membership ok, but business must be admin-approved to operate. */
export async function requireApprovedProviderAccess(
  userId: string,
  preferredProviderId?: string | null,
) {
  const access = await requireProviderAccess(userId, preferredProviderId);
  if (!access.provider.isApproved) {
    throw new Error("PROVIDER_NOT_APPROVED");
  }
  return access;
}

export function assertProviderApproved(access: ProviderAccess) {
  if (!access.provider.isApproved) {
    throw new Error("PROVIDER_NOT_APPROVED");
  }
}

export async function setActiveProviderCookie(providerId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_PROVIDER_COOKIE, providerId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });
}
