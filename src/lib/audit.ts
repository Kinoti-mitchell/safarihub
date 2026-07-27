import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";

export type AuditActor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Writes an audit trail entry. Uses raw SQL so it stays decoupled from the
 * generated client and never throws into the caller — a broken audit write
 * must not break the underlying admin action.
 */
export async function logAudit(params: {
  actor?: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await db.from("AuditLog").insert({
      id: createId(),
      actorId: params.actor?.id ?? null,
      actorName: params.actor?.name ?? null,
      actorEmail: params.actor?.email ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary,
      metadata: params.metadata ?? null,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

export async function listAuditLogs(options: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  query?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const limit = Math.min(options.limit ?? 100, 500);
  let query = db
    .from("AuditLog")
    .select(
      "id, actorId, actorName, actorEmail, action, entityType, entityId, summary, metadata, createdAt",
    )
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (options.entityType) query = query.eq("entityType", options.entityType);
  if (options.entityId) query = query.eq("entityId", options.entityId);
  if (options.actorId) query = query.eq("actorId", options.actorId);
  if (options.query) {
    const like = `%${options.query}%`;
    query = query.or(
      `summary.ilike.${like},actorEmail.ilike.${like},action.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as Omit<AuditLogEntry, "createdAt"> & { createdAt: string }),
    createdAt: new Date((row as { createdAt: string }).createdAt),
  })) as AuditLogEntry[];
}
