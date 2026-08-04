import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import {
  getPlatformSettings,
  boolSetting,
  numberSetting,
} from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const ACCOUNT_SELECT = "*, ledger:LoyaltyLedger(*)";

async function loadAccount(userId: string) {
  const { data, error } = await db
    .from("LoyaltyAccount")
    .select(ACCOUNT_SELECT)
    .eq("userId", userId)
    .order("createdAt", { referencedTable: "ledger", ascending: false })
    .limit(20, { referencedTable: "ledger" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    let account = await loadAccount(session.user.id);
    if (!account) {
      const { error: insertError } = await db
        .from("LoyaltyAccount")
        .insert({ id: createId(), userId: session.user.id, points: 0 });
      if (insertError) throw insertError;
      account = await loadAccount(session.user.id);
    }
    const settings = await getPlatformSettings();
    const pointValue = numberSetting(settings, "loyalty.pointValue") || 1;
    const kesPerPoint = numberSetting(settings, "loyalty.kesPerPoint") || 100;
    const enabled = boolSetting(settings, "flags.loyaltyEnabled");
    return jsonOk({
      account,
      pointValue,
      kesPerPoint,
      enabled,
      balanceKes: ((account?.points as number) || 0) * pointValue,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
