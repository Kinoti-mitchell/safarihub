"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  details: string | null;
  unit: string;
  unitPrice: number;
  minQty: number;
  isActive?: boolean;
};
type Supplier = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  phone: string | null;
  email?: string | null;
  isActive?: boolean;
  offers: Offer[];
};
type Order = {
  id: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  supplier: { name: string; category: string } | null;
  offer: { title: string; unit: string } | null;
};

type Tab = "mine" | "marketplace" | "orders";

export default function SuppliersPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [marketplace, setMarketplace] = useState<Supplier[]>([]);
  const [mine, setMine] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/suppliers");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load suppliers");
      return;
    }
    setError(null);
    setMarketplace(data.marketplace || data.suppliers || []);
    setMine(data.mine || []);
    setOrders(data.orders || []);
    setCategories(data.categories || []);
    setSetupRequired(Boolean(data.setupRequired));
    setSetupMessage(data.message || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function placeOrder(e: FormEvent<HTMLFormElement>, offerId: string) {
    e.preventDefault();
    setBusy(offerId);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/provider/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "order",
        offerId,
        quantity: Number(form.get("quantity") || 1),
        notes: form.get("notes"),
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Order failed");
      return;
    }
    setMsg(data.message || "Order placed");
    setTab("orders");
    void load();
  }

  async function registerSupplier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("register");
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/provider/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        name: fd.get("name"),
        category: fd.get("category"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        description: fd.get("description"),
        offerTitle: fd.get("offerTitle"),
        offerPrice: fd.get("offerPrice"),
        offerUnit: fd.get("offerUnit"),
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Could not register supplier");
      return;
    }
    setMsg(data.message || "Supplier registered");
    form.reset();
    void load();
  }

  async function addOffer(e: FormEvent<HTMLFormElement>, supplierId: string) {
    e.preventDefault();
    setBusy(`offer-${supplierId}`);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/provider/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "offer",
        supplierId,
        title: fd.get("title"),
        unitPrice: fd.get("unitPrice"),
        unit: fd.get("unit"),
        details: fd.get("details"),
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Could not add offer");
      return;
    }
    setMsg(data.message || "Offer added");
    form.reset();
    void load();
  }

  async function deactivate(supplierId: string, name: string) {
    if (!window.confirm(`Deactivate ${name}?`)) return;
    setBusy(supplierId);
    const res = await fetch(
      `/api/provider/suppliers?supplierId=${encodeURIComponent(supplierId)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Could not deactivate");
      return;
    }
    setMsg("Supplier deactivated");
    void load();
  }

  function renderSupplierCard(
    s: Supplier,
    opts: { canOrder: boolean; mine?: boolean },
  ) {
    const offers = (s.offers || []).filter((o) => o && o.isActive !== false);
    return (
      <section
        key={s.id}
        className="provider-card rounded-2xl border border-line p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">{s.name}</h2>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {s.category}
            {s.isActive === false ? " · inactive" : ""}
          </span>
        </div>
        {s.description && (
          <p className="mt-2 text-sm text-ink-muted">{s.description}</p>
        )}
        {(s.phone || s.email) && (
          <p className="mt-1 text-sm text-ink-muted">
            {[s.phone, s.email].filter(Boolean).join(" · ")}
          </p>
        )}
        <ul className="mt-4 space-y-4">
          {offers.map((o) => (
            <li
              key={o.id}
              className="border-t border-line/70 pt-4 sm:flex sm:items-end sm:justify-between sm:gap-4"
            >
              <div>
                <p className="font-medium text-ink">{o.title}</p>
                {o.details && (
                  <p className="mt-1 text-sm text-ink-muted">{o.details}</p>
                )}
                <p className="mt-1 text-sm text-lake">
                  KES {Number(o.unitPrice || 0).toLocaleString()} / {o.unit}
                </p>
              </div>
              {opts.canOrder && (
                <form
                  onSubmit={(e) => void placeOrder(e, o.id)}
                  className="mt-3 flex flex-wrap items-end gap-2 sm:mt-0"
                >
                  <label className="text-xs font-medium">
                    Qty
                    <input
                      name="quantity"
                      type="number"
                      min={o.minQty || 1}
                      defaultValue={o.minQty || 1}
                      className="mt-1 w-20 rounded border border-line px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy === o.id}
                    className="rounded-lg bg-lake px-3 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                  >
                    {busy === o.id ? "…" : "Order"}
                  </button>
                </form>
              )}
            </li>
          ))}
          {offers.length === 0 && (
            <li className="text-sm text-ink-muted">No offers yet.</li>
          )}
        </ul>

        {opts.mine && (
          <div className="mt-4 border-t border-line/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Add offer
            </p>
            <form
              onSubmit={(e) => void addOffer(e, s.id)}
              className="mt-2 grid gap-2 sm:grid-cols-4"
            >
              <input
                name="title"
                required
                placeholder="Offer title"
                className="rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                name="unitPrice"
                type="number"
                min={0}
                defaultValue={0}
                placeholder="Price KES"
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                name="unit"
                defaultValue="unit"
                placeholder="Unit"
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy === `offer-${s.id}`}
                className="rounded-lg border border-lake px-3 py-2 text-sm font-semibold text-lake disabled:opacity-60 sm:col-span-4 sm:justify-self-start"
              >
                {busy === `offer-${s.id}` ? "Saving…" : "Add offer"}
              </button>
            </form>
            <button
              type="button"
              disabled={busy === s.id}
              onClick={() => void deactivate(s.id, s.name)}
              className="mt-3 text-xs font-semibold text-red-700 hover:underline"
            >
              Deactivate supplier
            </button>
          </div>
        )}
      </section>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "mine", label: "My suppliers" },
    { id: "marketplace", label: "Marketplace" },
    { id: "orders", label: "Orders" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">Suppliers</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Register your own vendors, or order from the Safari Hub marketplace.
        Stock received can be logged under Inventory.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-lake text-sand"
                : "border border-line bg-white/70 text-ink-muted hover:border-lake-bright"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}
      {setupRequired && (
        <p className="mt-4 border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-ink">
          {setupMessage}
        </p>
      )}

      {tab === "mine" && (
        <div className="mt-8 space-y-6">
          <form
            onSubmit={(e) => void registerSupplier(e)}
            className="provider-card space-y-3 rounded-2xl border border-line p-5"
          >
            <h2 className="font-display text-lg font-semibold">
              Register a supplier
            </h2>
            <p className="text-sm text-ink-muted">
              Your private vendor list for this business — linen, produce,
              security, maintenance, and more.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium sm:col-span-2">
                Name
                <input
                  name="name"
                  required
                  minLength={2}
                  placeholder="Lake Produce Co."
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
                    : ["FOOD", "HOUSEKEEPING", "SECURITY", "GENERAL"]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Phone
                <input
                  name="phone"
                  type="tel"
                  placeholder="07xx xxx xxx"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium">
                Email
                <input
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium sm:col-span-2">
                Notes
                <input
                  name="description"
                  placeholder="What they supply"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
            </div>
            <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Optional first offer
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                name="offerTitle"
                placeholder="Offer title"
                className="rounded-lg border border-line px-3 py-2 text-sm sm:col-span-1"
              />
              <input
                name="offerPrice"
                type="number"
                min={0}
                placeholder="Price KES"
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                name="offerUnit"
                defaultValue="unit"
                placeholder="Unit"
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy === "register"}
              className="rounded-lg bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
            >
              {busy === "register" ? "Saving…" : "Register supplier"}
            </button>
          </form>

          {mine
            .filter((s) => s.isActive !== false)
            .map((s) => renderSupplierCard(s, { canOrder: true, mine: true }))}
          {mine.filter((s) => s.isActive !== false).length === 0 &&
            !setupRequired && (
              <p className="text-sm text-ink-muted">
                No private suppliers yet — register your first vendor above.
              </p>
            )}
        </div>
      )}

      {tab === "marketplace" && (
        <div className="mt-8 space-y-6">
          {marketplace.map((s) =>
            renderSupplierCard(s, { canOrder: true, mine: false }),
          )}
          {!setupRequired && marketplace.length === 0 && (
            <p className="text-sm text-ink-muted">
              No marketplace suppliers yet — check back soon.
            </p>
          )}
        </div>
      )}

      {tab === "orders" && (
        <section className="mt-8">
          <ul className="divide-y divide-line border-y border-line text-sm">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>
                  {o.offer?.title || "Order"} · {o.supplier?.name} · qty{" "}
                  {o.quantity}
                </span>
                <span>
                  KES {o.totalAmount.toLocaleString()} ·{" "}
                  <span className="font-medium">{o.status}</span>
                </span>
              </li>
            ))}
            {orders.length === 0 && (
              <li className="py-4 text-ink-muted">No orders yet.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
