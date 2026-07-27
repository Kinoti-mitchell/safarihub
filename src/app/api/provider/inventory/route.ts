import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  requireApprovedProviderAccess,
  requireProviderAccess,
} from "@/lib/provider";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { staffHasPermission } from "@/lib/staff-roles";

const CATEGORIES = [
  "FOOD",
  "BEVERAGE",
  "HOUSEKEEPING",
  "AMENITIES",
  "MAINTENANCE",
  "GENERAL",
] as const;

const REASONS = [
  "PURCHASE",
  "USAGE",
  "ADJUSTMENT",
  "WASTE",
  "RETURN",
] as const;

function missingInventory(err: { message?: string; code?: string } | null) {
  if (!err) return false;
  const msg = err.message || "";
  return (
    msg.includes("InventoryItem") ||
    err.code === "42P01" ||
    msg.includes("schema cache")
  );
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    if (
      !staffHasPermission(access.role, "inventory") &&
      session.user.role !== "ADMIN"
    ) {
      return jsonError("Forbidden", 403);
    }

    const providerId = access.provider.id;
    const [{ data: items, error }, suppliersRes, movementsRes] =
      await Promise.all([
        db
          .from("InventoryItem")
          .select("*, supplier:Supplier(id, name)")
          .eq("providerId", providerId)
          .eq("isActive", true)
          .order("name", { ascending: true }),
        db
          .from("Supplier")
          .select("id, name, category")
          .or(`providerId.eq.${providerId},providerId.is.null`)
          .eq("isActive", true)
          .order("name", { ascending: true })
          .limit(80),
        db
          .from("InventoryMovement")
          .select("id, itemId, delta, reason, notes, createdAt")
          .eq("providerId", providerId)
          .order("createdAt", { ascending: false })
          .limit(200),
      ]);

    const suppliers = suppliersRes.error ? [] : (suppliersRes.data ?? []);

    if (error) {
      if (missingInventory(error)) {
        return jsonOk({
          items: [],
          suppliers: [],
          categories: CATEGORIES,
          reasons: REASONS,
          setupRequired: true,
          message:
            "Run db/2026-provider-suppliers-inventory.sql in Supabase to enable inventory.",
        });
      }
      throw error;
    }

    const movementsByItem = new Map<
      string,
      Array<{
        id: string;
        delta: number;
        reason: string;
        notes: string | null;
        createdAt: string;
      }>
    >();
    if (!movementsRes.error) {
      for (const m of (movementsRes.data ?? []) as Array<{
        id: string;
        itemId: string;
        delta: number;
        reason: string;
        notes: string | null;
        createdAt: string;
      }>) {
        const list = movementsByItem.get(m.itemId) || [];
        if (list.length < 8) {
          list.push({
            id: m.id,
            delta: m.delta,
            reason: m.reason,
            notes: m.notes,
            createdAt: m.createdAt,
          });
          movementsByItem.set(m.itemId, list);
        }
      }
    }

    const normalized = (items ?? []).map((raw) => {
      const row = raw as unknown as {
        id: string;
        name: string;
        sku: string | null;
        category: string;
        unit: string;
        quantityOnHand: number;
        reorderLevel: number;
        unitCost: number;
        notes: string | null;
        supplierId: string | null;
        supplier:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
      };
      const supplier = Array.isArray(row.supplier)
        ? row.supplier[0]
        : row.supplier;
      return {
        ...row,
        supplier,
        movements: movementsByItem.get(row.id) || [],
        lowStock:
          row.reorderLevel > 0 && row.quantityOnHand <= row.reorderLevel,
      };
    });

    return jsonOk({
      items: normalized,
      suppliers,
      categories: CATEGORIES,
      reasons: REASONS,
      setupRequired: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * action:
 * - "create" (default) — new stock item
 * - "adjust" — change quantity with a movement reason
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireApprovedProviderAccess(session.user.id);
    if (
      !staffHasPermission(access.role, "inventory") &&
      session.user.role !== "ADMIN"
    ) {
      return jsonError("Forbidden", 403);
    }

    const body = await req.json();
    const action = String(body.action || "create").toLowerCase();
    if (action === "adjust") {
      return adjustStock(access.provider.id, session.user.id, body);
    }
    return createItem(access.provider.id, body);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireApprovedProviderAccess(session.user.id);
    if (
      !staffHasPermission(access.role, "inventory") &&
      session.user.role !== "ADMIN"
    ) {
      return jsonError("Forbidden", 403);
    }

    const body = await req.json();
    const itemId = String(body.itemId || "");
    if (!itemId) return jsonError("itemId required");

    const { data: existing, error: findErr } = await db
      .from("InventoryItem")
      .select("id")
      .eq("id", itemId)
      .eq("providerId", access.provider.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return jsonError("Item not found", 404);

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.sku != null) patch.sku = String(body.sku).trim() || null;
    if (body.category != null) patch.category = String(body.category).toUpperCase();
    if (body.unit != null) patch.unit = String(body.unit).trim() || "unit";
    if (body.reorderLevel != null) {
      patch.reorderLevel = Math.max(0, Math.round(Number(body.reorderLevel) || 0));
    }
    if (body.unitCost != null) {
      patch.unitCost = Math.max(0, Math.round(Number(body.unitCost) || 0));
    }
    if (body.notes != null) patch.notes = String(body.notes).trim() || null;
    if (body.supplierId !== undefined) {
      patch.supplierId = body.supplierId ? String(body.supplierId) : null;
    }

    const { error } = await db
      .from("InventoryItem")
      .update(patch)
      .eq("id", itemId)
      .eq("providerId", access.provider.id);
    if (error) throw error;

    return jsonOk({ ok: true, itemId });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireApprovedProviderAccess(session.user.id);
    if (
      !staffHasPermission(access.role, "inventory") &&
      session.user.role !== "ADMIN"
    ) {
      return jsonError("Forbidden", 403);
    }

    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId") || "";
    if (!itemId) return jsonError("itemId required");

    const { error } = await db
      .from("InventoryItem")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", itemId)
      .eq("providerId", access.provider.id);
    if (error) {
      if (missingInventory(error)) {
        return jsonError(
          "Run db/2026-provider-suppliers-inventory.sql first.",
          503,
        );
      }
      throw error;
    }

    return jsonOk({ ok: true, deactivated: itemId });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function createItem(providerId: string, body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  if (name.length < 2) return jsonError("Item name is required");

  const quantityOnHand = Math.max(0, Math.round(Number(body.quantityOnHand) || 0));
  const now = new Date().toISOString();
  const id = createId("inv");
  const row = {
    id,
    providerId,
    name,
    sku: String(body.sku || "").trim() || null,
    category: String(body.category || "GENERAL").toUpperCase(),
    unit: String(body.unit || "unit").trim() || "unit",
    quantityOnHand,
    reorderLevel: Math.max(0, Math.round(Number(body.reorderLevel) || 0)),
    unitCost: Math.max(0, Math.round(Number(body.unitCost) || 0)),
    supplierId: body.supplierId ? String(body.supplierId) : null,
    notes: String(body.notes || "").trim() || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const { error } = await db.from("InventoryItem").insert(row);
  if (error) {
    if (missingInventory(error)) {
      return jsonError(
        "Run db/2026-provider-suppliers-inventory.sql in Supabase first.",
        503,
      );
    }
    throw error;
  }

  if (quantityOnHand > 0) {
    await db.from("InventoryMovement").insert({
      id: createId("imv"),
      itemId: id,
      providerId,
      delta: quantityOnHand,
      reason: "ADJUSTMENT",
      notes: "Opening stock",
      createdById: null,
      createdAt: now,
    });
  }

  return jsonOk({ item: row, message: `${name} added to inventory.` });
}

async function adjustStock(
  providerId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const itemId = String(body.itemId || "");
  const delta = Math.round(Number(body.delta) || 0);
  const reason = String(body.reason || "ADJUSTMENT").toUpperCase();
  const notes = String(body.notes || "").trim() || null;

  if (!itemId) return jsonError("itemId required");
  if (!delta) return jsonError("Enter a non-zero quantity change");
  if (!(REASONS as readonly string[]).includes(reason)) {
    return jsonError("Invalid reason");
  }

  const { data: item, error } = await db
    .from("InventoryItem")
    .select("id, quantityOnHand, name")
    .eq("id", itemId)
    .eq("providerId", providerId)
    .eq("isActive", true)
    .maybeSingle();
  if (error) throw error;
  if (!item) return jsonError("Item not found", 404);

  const next = (item.quantityOnHand || 0) + delta;
  if (next < 0) {
    return jsonError(
      `Not enough stock (${item.quantityOnHand} on hand). Cannot go below zero.`,
    );
  }

  const now = new Date().toISOString();
  const { error: updErr } = await db
    .from("InventoryItem")
    .update({ quantityOnHand: next, updatedAt: now })
    .eq("id", itemId);
  if (updErr) throw updErr;

  const { error: movErr } = await db.from("InventoryMovement").insert({
    id: createId("imv"),
    itemId,
    providerId,
    delta,
    reason,
    notes,
    createdById: userId,
    createdAt: now,
  });
  if (movErr) throw movErr;

  return jsonOk({
    itemId,
    quantityOnHand: next,
    message: `${item.name}: ${delta > 0 ? "+" : ""}${delta} → ${next} on hand`,
  });
}
