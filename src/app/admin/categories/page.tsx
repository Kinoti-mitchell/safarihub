"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  LISTING_CATEGORY_KEYS,
  type ListingCategoryKey,
} from "@/lib/amenities";

type AmenityRow = {
  id: string;
  category: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const FILTER_KEYS = ["ALL", ...LISTING_CATEGORY_KEYS] as const;

function categoryTitle(key: string) {
  if (key === "ALL") return "All categories";
  return CATEGORY_LABELS[key as ListingCategoryKey]?.split(" (")[0] || key;
}

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<AmenityRow[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/category-labels?all=true");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load");
      return;
    }
    setError(null);
    setRows(data.labels || []);
    setSetup(data.setupRequired ? data.message : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((r) => r.category === filter || r.category === "ALL");
  }, [rows, filter]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/category-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.get("category"),
        name: form.get("name"),
        sortOrder: Number(form.get("sortOrder") || 100),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create");
      return;
    }
    setMsg(`Added “${data.label.name}” under ${categoryTitle(data.label.category)}`);
    e.currentTarget.reset();
    void load();
  }

  async function toggleActive(row: AmenityRow) {
    setBusy(true);
    const res = await fetch("/api/category-labels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, isActive: !row.isActive }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
      return;
    }
    void load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete amenity “${name}”?`)) return;
    setBusy(true);
    const res = await fetch(
      `/api/category-labels?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Delete failed");
      return;
    }
    void load();
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Categories &amp; amenities
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Providers pick a category (Stay, Eat, Move…). Then they only see{" "}
        <strong>amenities for that category</strong> — Eat → Restaurant / Wi‑Fi;
        Move → Car hire / Airport transfer. Shared amenities use “All
        categories”.
      </p>

      {setup && (
        <p className="mt-4 border border-sun/40 bg-sun/10 px-4 py-3 text-sm">
          {setup}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}

      <form
        onSubmit={onCreate}
        className="mt-8 grid gap-3 border border-line bg-white/70 p-5 sm:grid-cols-[1fr_1.4fr_auto_auto]"
      >
        <label className="text-sm font-medium">
          Under category
          <select
            name="category"
            required
            defaultValue="STAY"
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          >
            <option value="ALL">All categories (shared)</option>
            {LISTING_CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {categoryTitle(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Amenity name
          <input
            name="name"
            required
            minLength={2}
            placeholder="e.g. Wi‑Fi, Boutique hotel, Parking"
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Order
          <input
            name="sortOrder"
            type="number"
            defaultValue={100}
            className="mt-1 w-24 rounded-md border border-line px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
        >
          Add amenity
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTER_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === k
                ? "border-lake bg-lake text-sand"
                : "border-line text-ink-muted"
            }`}
          >
            {categoryTitle(k)}
          </button>
        ))}
      </div>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {visible.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <div>
              <span className="font-medium text-ink">{row.name}</span>
              <span className="text-ink-muted">
                {" "}
                · {categoryTitle(row.category)}
                {!row.isActive ? " · hidden" : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleActive(row)}
                className="rounded border border-line px-2 py-1 text-xs"
              >
                {row.isActive ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(row.id, row.name)}
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && !setup && (
          <li className="py-6 text-ink-muted">No amenities in this group yet.</li>
        )}
      </ul>
    </div>
  );
}
