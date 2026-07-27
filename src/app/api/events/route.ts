import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId, slugify } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const { data: events, error } = await db
      .from("Event")
      .select("*, county:County(*)")
      .eq("isPublished", true)
      .order("startsAt", { ascending: true })
      .limit(40);
    if (error) throw error;
    return jsonOk({ events });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }
    const body = z
      .object({
        title: z.string().min(3),
        description: z.string().optional(),
        countyId: z.string().optional(),
        startsAt: z.string(),
        endsAt: z.string().optional(),
        venue: z.string().optional(),
        imageUrl: z.string().optional(),
        isPublished: z.boolean().default(true),
      })
      .parse(await request.json());

    const { data: event, error } = await db
      .from("Event")
      .insert({
        id: createId(),
        title: body.title,
        slug: `${slugify(body.title)}-${createId().slice(0, 5)}`,
        description: body.description ?? null,
        countyId: body.countyId ?? null,
        startsAt: new Date(body.startsAt).toISOString(),
        endsAt: body.endsAt ? new Date(body.endsAt).toISOString() : null,
        venue: body.venue ?? null,
        imageUrl: body.imageUrl ?? null,
        isPublished: body.isPublished,
      })
      .select("*")
      .single();
    if (error) throw error;
    await logAudit({
      actor: session.user,
      action: "event.create",
      entityType: "Event",
      entityId: event.id,
      summary: `Created event "${event.title}"`,
    });

    return jsonOk({ event }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
