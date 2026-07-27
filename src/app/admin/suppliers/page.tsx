"use client";

import { useCallback, useEffect, useState } from "react";

type Order = {
  id: string;
  quantity: number;
  totalAmount: number;
  status: string;
  provider: { name: string } | null;
  supplier: { name: string } | null;
  offer: { title: string } | null;
};

export default function AdminSuppliersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplierCount, setSupplierCount] = useState(0);
  const [setup, setSetup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/suppliers");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    setError(null);
    setOrders(data.orders || []);
    setSupplierCount((data.suppliers || []).length);
    setSetup(data.setupRequired ? data.message : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(orderId: string, status: string) {
    setBusy(orderId);
    const res = await fetch("/api/admin/suppliers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    void load();
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Supplier marketplace
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        B2B orders between operators and suppliers — commissionable as density
        grows. {supplierCount} suppliers on platform.
      </p>
      {setup && (
        <p className="mt-4 border border-sun/40 bg-sun/10 px-4 py-3 text-sm">
          {setup}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
        {orders.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div>
              <p className="font-medium text-ink">
                {o.offer?.title || "Order"} · {o.supplier?.name}
              </p>
              <p className="text-ink-muted">
                {o.provider?.name} · qty {o.quantity} · KES{" "}
                {o.totalAmount.toLocaleString()} · {o.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["CONFIRMED", "FULFILLED", "CANCELLED"].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy === o.id || o.status === s}
                  onClick={() => void setStatus(o.id, s)}
                  className="rounded border border-line px-2 py-1 text-xs font-medium disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </li>
        ))}
        {orders.length === 0 && !setup && (
          <li className="py-6 text-ink-muted">No supplier orders yet.</li>
        )}
      </ul>
    </div>
  );
}
