import { z } from "zod";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { createId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { BOOST_PERIODS, isBoostPeriod } from "@/lib/boost";

export async function GET() {
  try {
    await requireAdminPermission("boost.manage");
    const { data, error } = await db
      .from("BoostPlan")
      .select("*")
      .order("sortOrder", { ascending: true });
    if (error) throw error;

    // Ensure all four periods exist (migration may not have run yet).
    const existing = new Set((data ?? []).map((p) => p.period as string));
    const defaults: Record<string, { label: string; priceKes: number; sortOrder: number }> = {
      DAILY: { label: "Daily boost", priceKes: 500, sortOrder: 1 },
      WEEKLY: { label: "Weekly boost", priceKes: 2500, sortOrder: 2 },
      MONTHLY: { label: "Monthly boost", priceKes: 8000, sortOrder: 3 },
      YEARLY: { label: "Yearly boost", priceKes: 70000, sortOrder: 4 },
    };
    const now = new Date().toISOString();
    for (const period of BOOST_PERIODS) {
      if (existing.has(period)) continue;
      const d = defaults[period];
      await db.from("BoostPlan").upsert(
        {
          id: `boost_plan_${period.toLowerCase()}`,
          period,
          label: d.label,
          priceKes: d.priceKes,
          active: true,
          sortOrder: d.sortOrder,
          createdAt: now,
          updatedAt: now,
        },
        { onConflict: "period" },
      );
    }

    const { data: plans, error: reloadError } = await db
      .from("BoostPlan")
      .select("*")
      .order("sortOrder", { ascending: true });
    if (reloadError) throw reloadError;
    return jsonOk({ plans: plans ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

const planPatchSchema = z.object({
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  priceKes: z.number().int().min(0).optional(),
  label: z.string().min(2).max(80).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminPermission("boost.manage");
    const body = planPatchSchema.parse(await request.json());
    if (!isBoostPeriod(body.period)) {
      return jsonError("Invalid period", 400);
    }

    const { data: existing } = await db
      .from("BoostPlan")
      .select("*")
      .eq("period", body.period)
      .maybeSingle();

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (body.priceKes != null) patch.priceKes = body.priceKes;
    if (body.label != null) patch.label = body.label.trim();
    if (body.active != null) patch.active = body.active;

    let plan;
    if (existing) {
      const { data, error } = await db
        .from("BoostPlan")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      plan = data;
    } else {
      const { data, error } = await db
        .from("BoostPlan")
        .insert({
          id: createId("boost_plan"),
          period: body.period,
          label: body.label?.trim() || `${body.period} boost`,
          priceKes: body.priceKes ?? 0,
          active: body.active ?? true,
          sortOrder: BOOST_PERIODS.indexOf(body.period) + 1,
          createdAt: now,
          updatedAt: now,
        })
        .select("*")
        .single();
      if (error) throw error;
      plan = data;
    }

    await logAudit({
      actor: admin,
      action: "boost.plan.update",
      entityType: "BoostPlan",
      entityId: plan.id,
      summary: `Updated ${plan.period} boost — KES ${plan.priceKes}${plan.active ? "" : " (off)"}`,
      metadata: body,
    });

    return jsonOk({ plan });
  } catch (error) {
    return handleRouteError(error);
  }
}
