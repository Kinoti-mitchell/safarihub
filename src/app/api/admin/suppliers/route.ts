import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";


export async function GET() {
  try {
    await requireAdminPermission("supplier.manage");
    const [{ data: suppliers, error: sErr }, { data: orders, error: oErr }] =
      await Promise.all([
        db
          .from("Supplier")
          .select("*, offers:SupplierOffer(*)")
          .order("name", { ascending: true }),
        db
          .from("SupplierOrder")
          .select(
            "*, provider:Provider(name), supplier:Supplier(name), offer:SupplierOffer(title)",
          )
          .order("createdAt", { ascending: false })
          .limit(80),
      ]);
    if (sErr || oErr) {
      const err = sErr || oErr;
      if (err?.code === "42P01" || err?.message?.includes("Supplier")) {
        return jsonOk({
          suppliers: [],
          orders: [],
          setupRequired: true,
          message: "Run db/2026-hospitality-os.sql to enable suppliers.",
        });
      }
      if (sErr) throw sErr;
      if (oErr) throw oErr;
    }
    return jsonOk({
      suppliers: suppliers ?? [],
      orders: orders ?? [],
      setupRequired: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminPermission("supplier.manage");
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const status = String(body.status || "").toUpperCase();
    const allowed = new Set([
      "PENDING",
      "CONFIRMED",
      "FULFILLED",
      "CANCELLED",
    ]);
    if (!orderId || !allowed.has(status)) {
      return jsonError("orderId and valid status required");
    }
    const { error } = await db
      .from("SupplierOrder")
      .update({ status, updatedAt: new Date().toISOString() })
      .eq("id", orderId);
    if (error) throw error;
    return jsonOk({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
