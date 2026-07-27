import { db } from "@/lib/supabase";
import type { Session } from "next-auth";
import { getProviderForUser } from "@/lib/provider";

export type Viewer = "TRAVELER" | "PROVIDER" | "ADMIN" | null;

/**
 * Decide how the current session relates to a conversation and whether they may
 * view it. Providers may see their own conversations; admins see everything;
 * travelers see conversations they started.
 */
export async function resolveConversationAccess(
  session: Session | null,
  conversation: { providerId: string; travelerId: string | null },
): Promise<{ allowed: boolean; viewer: Viewer }> {
  if (!session?.user) return { allowed: false, viewer: null };
  if (session.user.role === "ADMIN") return { allowed: true, viewer: "ADMIN" };
  if (conversation.travelerId === session.user.id) {
    return { allowed: true, viewer: "TRAVELER" };
  }
  const access = await getProviderForUser(session.user.id);
  if (access && access.provider.id === conversation.providerId) {
    return { allowed: true, viewer: "PROVIDER" };
  }
  return { allowed: false, viewer: null };
}
