import { db } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { boolSetting, getPlatformSettings } from "@/lib/settings";
import { BOOST_PERIODS } from "@/lib/boost";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const settings = await getPlatformSettings();
    const enabled = boolSetting(settings, "boost.enabled");
    const paymentInstructions = String(
      settings["boost.paymentInstructions"] ||
        "Pay via M-Pesa, then submit your confirmation code with the boost request.",
    );
    const paybill = String(settings["payments.mpesaPaybill"] || "");

    const { data, error } = await db
      .from("BoostPlan")
      .select("id, period, label, priceKes, active, sortOrder")
      .eq("active", true)
      .order("sortOrder", { ascending: true });
    if (error) throw error;

    let plans = data ?? [];
    if (!plans.length) {
      // Fallback display if migration not applied yet
      plans = BOOST_PERIODS.map((period, i) => ({
        id: `boost_plan_${period.toLowerCase()}`,
        period,
        label: `${period.charAt(0)}${period.slice(1).toLowerCase()} boost`,
        priceKes: [500, 2500, 8000, 70000][i],
        active: true,
        sortOrder: i + 1,
      }));
    }

    return jsonOk({
      enabled,
      paymentInstructions,
      paybill,
      plans: enabled ? plans : [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
