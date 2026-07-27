"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Movement = {
  id: string;
  delta: number;
  reason: string;
  notes: string | null;
  createdAt: string;
};

type Item = {
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
  supplier: { id: string; name: string } | null;
  movements: Movement[];
  lowStock: boolean;
};

type SupplierOpt = { id: string; name: string; category: string };

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjustId, setAdjustId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/inventory");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load inventory");
      return;
    }
    setError(null);
    setItems(data.items || []);
    setSuppliers(data.suppliers || []);
    setCategories(data.categories || []);
    setReasons(data.reasons || []);
    setSetupRequired(Boolean(data.setupRequired));
    setSetupMessage(data.message || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/provider/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: fd.get("name"),
        sku: fd.get("sku"),
        category: fd.get("category"),
        unit: fd.get("unit"),
        quantityOnHand: fd.get("quantityOnHand"),
        reorderLevel: fd.get("reorderLevel"),
        unitCost: fd.get("unitCost"),
        supplierId: fd.get("supplierId") || null,
        notes: fd.get("notes"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add item");
      return;
    }
    setMsg(data.message || "Item added");
    form.reset();
    void load();
  }

  async function adjustStock(e: FormEvent<HTMLFormElement>, itemId: string) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const direction = String(fd.get("direction") || "in");
    const qty = Math.abs(Math.round(Number(fd.get("qty") || 0)));
    const delta = direction === "out" ? -qty : qty;
    const res = await fetch("/api/provider/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust",
        itemId,
        delta,
        reason: fd.get("reason"),
        notes: fd.get("notes"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update stock");
      return;
    }
    setMsg(data.message || "Stock updated");
    setAdjustId(null);
    void load();
  }

  async function removeItem(itemId: string, name: string) {
    if (!window.confirm(`Remove ${name} from inventory?`)) return;
    setBusy(true);
    const res = await fetch(
      `/api/provider/inventory?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not remove item");
      return;
    }
    setMsg("Item removed");
    void load();
  }

  const lowCount = items.filter((i) => i.lowStock).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Inventory
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Track stock for this business — linen, F&amp;B, amenities, cleaning
        supplies. Link items to{" "}
        <Link
          href="/provider/suppliers"
          className="font-medium text-lake-bright underline decoration-lake-bright/40 underline-offset-2"
        >
          suppliers
        </Link>{" "}
        you register.
      </p>

      {lowCount > 0 && (
        <p className="mt-4 rounded-xl border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-ink">
          {lowCount} item{lowCount === 1 ? "" : "s"} at or below reorder level.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}
      {setupRequired && (
        <p className="mt-4 border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-ink">
          {setupMessage}
        </p>
      )}

      <form
        onSubmit={(e) => void createItem(e)}
        className="provider-card mt-8 space-y-3 rounded-2xl border border-line p-5"
      >
        <h2 className="font-display text-lg font-semibold">Add stock item</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium sm:col-span-2">
            Name
            <input
              name="name"
              required
              minLength={2}
              placeholder="Bath towels"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            SKU (optional)
            <input
              name="sku"
              placeholder="LIN-TOW-01"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Category
            <select
              name="category"
              defaultValue="GENERAL"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              {(categories.length
                ? categories
                : ["FOOD", "HOUSEKEEPING", "GENERAL"]
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Unit
            <input
              name="unit"
              defaultValue="unit"
              placeholder="pcs / crate / litre"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Opening qty
            <input
              name="quantityOnHand"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Reorder level
            <input
              name="reorderLevel"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Unit cost (KES)
            <input
              name="unitCost"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Preferred supplier
            <select
              name="supplierId"
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Notes
            <input
              name="notes"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add to inventory"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Stock on hand</h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-4 ${
                item.lowStock
                  ? "border-sun/50 bg-sun/10"
                  : "border-line bg-white/70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">
                    {item.name}
                    {item.lowStock && (
                      <span className="ml-2 text-xs font-semibold uppercase text-sun">
                        Low
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {item.category}
                    {item.sku ? ` · ${item.sku}` : ""}
                    {item.supplier ? ` · ${item.supplier.name}` : ""}
                  </p>
                </div>
                <p className="font-display text-2xl font-semibold text-lake">
                  {item.quantityOnHand}
                  <span className="ml-1 text-sm font-sans font-normal text-ink-muted">
                    {item.unit}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Reorder at {item.reorderLevel} · cost KES{" "}
                {item.unitCost.toLocaleString()} / {item.unit}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAdjustId(adjustId === item.id ? null : item.id)
                  }
                  className="rounded-md border border-lake px-3 py-1.5 text-xs font-semibold text-lake"
                >
                  Adjust stock
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeItem(item.id, item.name)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-red-700 hover:underline"
                >
                  Remove
                </button>
              </div>

              {adjustId === item.id && (
                <form
                  onSubmit={(e) => void adjustStock(e, item.id)}
                  className="mt-3 grid gap-2 rounded-lg border border-line/80 bg-sand/20 p-3 sm:grid-cols-4"
                >
                  <label className="text-xs font-medium">
                    In / out
                    <select
                      name="direction"
                      defaultValue="in"
                      className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                    >
                      <option value="in">Receive (+)</option>
                      <option value="out">Use / issue (−)</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Qty
                    <input
                      name="qty"
                      type="number"
                      min={1}
                      required
                      defaultValue={1}
                      className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium">
                    Reason
                    <select
                      name="reason"
                      defaultValue="PURCHASE"
                      className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                    >
                      {(reasons.length
                        ? reasons
                        : ["PURCHASE", "USAGE", "ADJUSTMENT", "WASTE"]
                      ).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium sm:col-span-4">
                    Notes
                    <input
                      name="notes"
                      className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-lake px-3 py-2 text-xs font-semibold text-sand disabled:opacity-60 sm:col-span-4 sm:justify-self-start"
                  >
                    Save movement
                  </button>
                </form>
              )}

              {item.movements?.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                  {item.movements.map((m) => (
                    <li key={m.id}>
                      {new Date(m.createdAt).toLocaleString()} ·{" "}
                      {m.delta > 0 ? "+" : ""}
                      {m.delta} · {m.reason}
                      {m.notes ? ` — ${m.notes}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {items.length === 0 && !setupRequired && (
            <li className="py-6 text-sm text-ink-muted">
              No stock items yet — add linen, food, or amenity items above.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
