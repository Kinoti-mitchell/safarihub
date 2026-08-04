import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  requireApprovedProviderAccess,
  requireProviderAccess,
} from "@/lib/provider";
import { createId, slugify } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { staffHasPermission } from "@/lib/staff-roles";
import { validateKenyanPhone } from "@/lib/identity";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

async function suppliersDisabledResponse() {
  const settings = await getPlatformSettings();
  if (!boolSetting(settings, "flags.suppliersEnabled")) {
    return jsonError("Supplier marketplace is currently disabled", 403);
  }
  return null;
}

const CATEGORIES = [
  "FOOD",
  "HOUSEKEEPING",
  "SECURITY",
  "MAINTENANCE",
  "BEVERAGE",
  "GENERAL",
] as const;

function missingTable(err: { message?: string; code?: string } | null) {
  if (!err) return false;
  const msg = err.message || "";
  return msg.includes("Supplier") || err.code === "42P01" || msg.includes("schema cache");
}

/** Marketplace + my suppliers + orders for the active business. */
export async function GET() {
  try {
    const disabled = await suppliersDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    if (!staffHasPermission(access.role, "suppliers") && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const providerId = access.provider.id;

    const marketplaceQuery = db
      .from("Supplier")
      .select("*, offers:SupplierOffer(*)")
      .eq("isActive", true)
      .is("providerId", null)
      .order("name", { ascending: true });

    const mineQuery = db
      .from("Supplier")
      .select("*, offers:SupplierOffer(*)")
      .eq("providerId", providerId)
      .order("name", { ascending: true });

    const ordersQuery = db
      .from("SupplierOrder")
      .select(
        "*, supplier:Supplier(name, category), offer:SupplierOffer(title, unit)",
      )
      .eq("providerId", providerId)
      .order("createdAt", { ascending: false })
      .limit(40);

    const [marketRes, mineRes, ordersRes] = await Promise.all([
      marketplaceQuery,
      mineQuery,
      ordersQuery,
    ]);

    // Older DBs without providerId: fall back to all active suppliers as marketplace
    if (marketRes.error && missingTable(marketRes.error)) {
      return jsonOk({
        marketplace: [],
        mine: [],
        orders: [],
        categories: CATEGORIES,
        setupRequired: true,
        message:
          "Run db/2026-hospitality-os.sql and db/2026-provider-suppliers-inventory.sql in Supabase.",
      });
    }

    if (marketRes.error) {
      // Column may not exist yet — treat all as marketplace
      const msg = marketRes.error.message || "";
      if (msg.includes("providerId") || marketRes.error.code === "42703") {
        const fallback = await db
          .from("Supplier")
          .select("*, offers:SupplierOffer(*)")
          .eq("isActive", true)
          .order("name", { ascending: true });
        if (fallback.error) throw fallback.error;
        return jsonOk({
          marketplace: fallback.data ?? [],
          mine: [],
          orders: ordersRes.data ?? [],
          categories: CATEGORIES,
          setupRequired: true,
          message:
            "Run db/2026-provider-suppliers-inventory.sql to enable registering your own suppliers.",
        });
      }
      throw marketRes.error;
    }
    if (mineRes.error) throw mineRes.error;
    if (ordersRes.error && !missingTable(ordersRes.error)) throw ordersRes.error;

    return jsonOk({
      marketplace: marketRes.data ?? [],
      mine: mineRes.data ?? [],
      orders: ordersRes.error ? [] : (ordersRes.data ?? []),
      categories: CATEGORIES,
      setupRequired: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Body.action:
 * - "order" (default) — place marketplace / offer order
 * - "register" — create a private supplier for this business
 * - "offer" — add an offer to one of your suppliers
 */
export async function POST(req: Request) {
  try {
    const disabled = await suppliersDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireApprovedProviderAccess(session.user.id);
    if (!staffHasPermission(access.role, "suppliers") && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const body = await req.json();
    const action = String(body.action || "order").toLowerCase();

    if (action === "register") {
      return registerSupplier(access.provider.id, body);
    }
    if (action === "offer") {
      return addOffer(access.provider.id, body);
    }
    return placeOrder(access.provider.id, body);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const disabled = await suppliersDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireApprovedProviderAccess(session.user.id);
    if (!staffHasPermission(access.role, "suppliers") && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const body = await req.json();
    const supplierId = String(body.supplierId || "");
    if (!supplierId) return jsonError("supplierId required");

    const { data: existing, error: findErr } = await db
      .from("Supplier")
      .select("id, providerId")
      .eq("id", supplierId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing || existing.providerId !== access.provider.id) {
      return jsonError("Supplier not found", 404);
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.category != null) patch.category = String(body.category).toUpperCase();
    if (body.description != null) {
      patch.description = String(body.description).trim() || null;
    }
    if (body.phone != null) {
      const phoneResult = validateKenyanPhone(body.phone, { required: false });
      if (phoneResult.error) return jsonError(phoneResult.error);
      patch.phone = phoneResult.phone;
    }
    if (body.email != null) {
      patch.email = String(body.email).trim().toLowerCase() || null;
    }
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

    const { error } = await db
      .from("Supplier")
      .update(patch)
      .eq("id", supplierId)
      .eq("providerId", access.provider.id);
    if (error) throw error;

    return jsonOk({ ok: true, supplierId });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const disabled = await suppliersDisabledResponse();
    if (disabled) return disabled;
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireApprovedProviderAccess(session.user.id);
    if (!staffHasPermission(access.role, "suppliers") && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const url = new URL(req.url);
    const supplierId = url.searchParams.get("supplierId") || "";
    if (!supplierId) return jsonError("supplierId required");

    const { data: existing, error: findErr } = await db
      .from("Supplier")
      .select("id, providerId")
      .eq("id", supplierId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing || existing.providerId !== access.provider.id) {
      return jsonError("Supplier not found", 404);
    }

    // Soft-deactivate so order history stays intact
    const { error } = await db
      .from("Supplier")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", supplierId);
    if (error) throw error;

    return jsonOk({ ok: true, deactivated: supplierId });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function registerSupplier(
  providerId: string,
  body: Record<string, unknown>,
) {
  const name = String(body.name || "").trim();
  if (name.length < 2) return jsonError("Supplier name is required");
  const category = String(body.category || "GENERAL").toUpperCase();
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return jsonError("Invalid category");
  }
  const phoneResult = validateKenyanPhone(body.phone as string, {
    required: false,
  });
  if (phoneResult.error) return jsonError(phoneResult.error);
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const description = String(body.description || "").trim() || null;

  const base = slugify(name) || "supplier";
  const slug = `${base}-${providerId.slice(-6)}-${createId().slice(0, 4)}`;
  const now = new Date().toISOString();
  const id = createId("sup");

  const row = {
    id,
    name,
    slug,
    category,
    description,
    phone: phoneResult.phone,
    email: email || null,
    providerId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const { error } = await db.from("Supplier").insert(row);
  if (error) {
    if (error.message?.includes("providerId") || error.code === "42703") {
      return jsonError(
        "Run db/2026-provider-suppliers-inventory.sql in Supabase first.",
        503,
      );
    }
    throw error;
  }

  // Optional first offer
  const offerTitle = String(body.offerTitle || "").trim();
  if (offerTitle) {
    const unitPrice = Math.max(0, Math.round(Number(body.offerPrice) || 0));
    const unit = String(body.offerUnit || "unit").trim() || "unit";
    const minQty = Math.max(1, Math.round(Number(body.offerMinQty) || 1));
    await db.from("SupplierOffer").insert({
      id: createId("soff"),
      supplierId: id,
      title: offerTitle,
      details: String(body.offerDetails || "").trim() || null,
      unit,
      unitPrice,
      minQty,
      isActive: true,
      createdAt: now,
    });
  }

  return jsonOk({
    supplier: row,
    message: `${name} registered for your business.`,
  });
}

async function addOffer(providerId: string, body: Record<string, unknown>) {
  const supplierId = String(body.supplierId || "");
  const title = String(body.title || "").trim();
  if (!supplierId) return jsonError("supplierId required");
  if (!title) return jsonError("Offer title required");

  const { data: supplier, error } = await db
    .from("Supplier")
    .select("id, providerId")
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw error;
  if (!supplier || supplier.providerId !== providerId) {
    return jsonError("Supplier not found", 404);
  }

  const offer = {
    id: createId("soff"),
    supplierId,
    title,
    details: String(body.details || "").trim() || null,
    unit: String(body.unit || "unit").trim() || "unit",
    unitPrice: Math.max(0, Math.round(Number(body.unitPrice) || 0)),
    minQty: Math.max(1, Math.round(Number(body.minQty) || 1)),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  const { error: insErr } = await db.from("SupplierOffer").insert(offer);
  if (insErr) throw insErr;

  return jsonOk({ offer, message: "Offer added" });
}

async function placeOrder(providerId: string, body: Record<string, unknown>) {
  const offerId = String(body.offerId || "");
  const quantity = Math.max(1, Number(body.quantity) || 1);
  const notes = String(body.notes || "").trim();

  if (!offerId) return jsonError("offerId required");

  const { data: offer, error: offerErr } = await db
    .from("SupplierOffer")
    .select("*, supplier:Supplier(*)")
    .eq("id", offerId)
    .eq("isActive", true)
    .maybeSingle();
  if (offerErr) {
    if (missingTable(offerErr)) {
      return jsonError(
        "Run db/2026-hospitality-os.sql in Supabase first.",
        503,
      );
    }
    throw offerErr;
  }
  if (!offer) return jsonError("Offer not found", 404);

  const supplier = (
    Array.isArray(offer.supplier) ? offer.supplier[0] : offer.supplier
  ) as { id: string; providerId?: string | null; isActive?: boolean } | null;

  if (!supplier) return jsonError("Supplier missing", 404);
  // May order from marketplace (providerId null) or own private suppliers
  if (
    supplier.providerId != null &&
    supplier.providerId !== providerId
  ) {
    return jsonError("You can only order from the marketplace or your own suppliers");
  }
  if (quantity < (offer.minQty || 1)) {
    return jsonError(`Minimum quantity is ${offer.minQty}`);
  }

  const unitPrice = offer.unitPrice || 0;
  const row = {
    id: createId("sord"),
    providerId,
    supplierId: offer.supplierId,
    offerId: offer.id,
    quantity,
    unitPrice,
    totalAmount: unitPrice * quantity,
    status: "PENDING",
    notes: notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await db.from("SupplierOrder").insert(row);
  if (error) throw error;

  return jsonOk({
    order: row,
    message: "Order placed — mark receipt in inventory when stock arrives.",
  });
}
