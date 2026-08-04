import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import {
  getPlatformSettings,
  boolSetting,
  numberSetting,
} from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

/**
 * Deduct loyalty points and return the KES discount value.
 * Used when previewing or applying a redeem; booking POST also applies inline.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const settings = await getPlatformSettings();
    if (!boolSetting(settings, "flags.loyaltyEnabled")) {
      return jsonError("Loyalty is currently disabled", 400);
    }

    const body = z
      .object({
        points: z.number().int().min(1),
        /** Optional cap so redeem never exceeds a cart total */
        maxDiscountKes: z.number().int().min(0).optional(),
        reason: z.string().max(200).optional(),
        /** Preview only — calculate without deducting */
        dryRun: z.boolean().optional(),
      })
      .parse(await request.json());

    const pointValue = numberSetting(settings, "loyalty.pointValue") || 1;
    if (pointValue <= 0) {
      return jsonError("Loyalty point value is not configured", 400);
    }

    const { data: account } = await db
      .from("LoyaltyAccount")
      .select("id, points")
      .eq("userId", session.user.id)
      .maybeSingle();
    if (!account || (account.points as number) < 1) {
      return jsonError("No loyalty points available", 400);
    }

    const available = account.points as number;
    let pointsUsed = Math.min(body.points, available);
    let discountKes = pointsUsed * pointValue;
    if (body.maxDiscountKes != null && discountKes > body.maxDiscountKes) {
      pointsUsed = Math.floor(body.maxDiscountKes / pointValue);
      discountKes = pointsUsed * pointValue;
    }
    if (pointsUsed < 1) {
      return jsonError("Not enough points for a redeemable discount", 400);
    }

    if (body.dryRun) {
      return jsonOk({ discountKes, pointsUsed, pointValue });
    }

    const now = new Date().toISOString();
    const { error: updError } = await db
      .from("LoyaltyAccount")
      .update({
        points: available - pointsUsed,
        updatedAt: now,
      })
      .eq("id", account.id as string)
      .eq("points", available);
    if (updError) throw updError;

    await db.from("LoyaltyLedger").insert({
      id: createId(),
      accountId: account.id as string,
      points: -pointsUsed,
      reason: body.reason?.trim() || "Points redeemed",
    });

    return jsonOk({ discountKes, pointsUsed, pointValue });
  } catch (error) {
    return handleRouteError(error);
  }
}
