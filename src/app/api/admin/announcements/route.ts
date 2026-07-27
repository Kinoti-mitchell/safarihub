import { z } from "zod";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  body: z.string().trim().min(2, "Message is required").max(1000),
  linkUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  audience: z.enum(["ALL", "TOURIST", "PROVIDER"]).default("ALL"),
});

export async function GET() {
  try {
    await requireAdminPermission("announcement.manage");
    const { data: announcements, error } = await db
      .from("Announcement")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(100);
    if (error) throw error;
    return jsonOk({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("announcement.manage");
    const json = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const { title, body, linkUrl, audience } = parsed.data;
    const { data: announcement, error } = await db
      .from("Announcement")
      .insert({
        id: createId(),
        title,
        body,
        linkUrl: linkUrl ? linkUrl : null,
        audience,
        createdById: admin.id ?? null,
        updatedAt: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    await logAudit({
      actor: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
      action: "announcement.create",
      entityType: "Announcement",
      entityId: announcement.id,
      summary: `Broadcast "${title}" to ${audience.toLowerCase()}`,
    });
    return jsonOk({ announcement }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
