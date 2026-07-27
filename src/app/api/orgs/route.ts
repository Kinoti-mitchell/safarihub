import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId, slugify } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { data: memberships, error } = await db
      .from("OrgMember")
      .select("*, organization:Organization(*)")
      .eq("userId", session.user.id);
    if (error) throw error;
    return jsonOk({
      organizations: (memberships ?? []).map((m) => m.organization),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const body = z
      .object({
        name: z.string().min(2),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .parse(await request.json());

    const orgId = createId();
    const { data: org, error: orgError } = await db
      .from("Organization")
      .insert({
        id: orgId,
        name: body.name,
        slug: `${slugify(body.name)}-${createId().slice(0, 5)}`,
        email: body.email ?? null,
        phone: body.phone ?? null,
      })
      .select("*")
      .single();
    if (orgError) throw orgError;

    const { error: memberError } = await db.from("OrgMember").insert({
      id: createId(),
      organizationId: orgId,
      userId: session.user.id,
      role: "TOURIST",
    });
    if (memberError) throw memberError;

    return jsonOk({ organization: org }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
