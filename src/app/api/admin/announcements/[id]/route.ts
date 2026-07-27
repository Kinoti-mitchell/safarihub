import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("announcement.manage");
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return jsonError("Invalid input", 400);
    }
    const { data: announcement, error } = await db
      .from("Announcement")
      .update({ active: parsed.data.active, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await logAudit({
      actor: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
      action: "announcement.update",
      entityType: "Announcement",
      entityId: id,
      summary: `${parsed.data.active ? "Activated" : "Paused"} broadcast "${announcement.title}"`,
    });
    return jsonOk({ announcement });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("announcement.manage");
    const { id } = await params;
    const { data: announcement, error } = await db
      .from("Announcement")
      .delete()
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await logAudit({
      actor: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
      action: "announcement.delete",
      entityType: "Announcement",
      entityId: id,
      summary: `Deleted broadcast "${announcement.title}"`,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
