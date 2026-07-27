import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdminPermission("market.manage");
    const { data, error } = await db
      .from("County")
      .select("*, towns:Town(*), country:Country(*), listings:Listing(count)")
      .order("name", { ascending: true });
    if (error) throw error;
    const counties = (
      (data ?? []) as Array<
        Record<string, unknown> & { listings?: Array<{ count: number }> }
      >
    ).map((c) => {
      const { listings, ...rest } = c;
      return { ...rest, _count: { listings: listings?.[0]?.count ?? 0 } };
    });
    return jsonOk({ counties });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminPermission("market.manage");
    const body = z
      .object({ id: z.string(), isLive: z.boolean() })
      .parse(await request.json());
    const { data: county, error } = await db
      .from("County")
      .update({ isLive: body.isLive, updatedAt: new Date().toISOString() })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: body.isLive ? "county.live" : "county.dark",
      entityType: "County",
      entityId: county.id,
      summary: `${county.name} set ${body.isLive ? "live" : "dark"}`,
      metadata: { isLive: body.isLive },
    });

    return jsonOk({ county });
  } catch (error) {
    return handleRouteError(error);
  }
}
