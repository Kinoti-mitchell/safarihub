"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AdminCounty = {
  id: string;
  name: string;
  slug: string;
  isLive: boolean;
  country: { name: string } | null;
  towns: { id: string }[];
  _count: { listings: number };
};

type Toast = { id: number; message: string; tone: "success" | "error" };

export default function AdminMarketsPage() {
  const [counties, setCounties] = useState<AdminCounty[]>([]);
  const [query, setQuery] = useState("");
  const [onlyLive, setOnlyLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/counties");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load markets");
        return;
      }
      setError(null);
      setCounties(body.counties || []);
    } catch {
      setError("Network error — could not load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(county: AdminCounty) {
    setBusyId(county.id);
    try {
      const res = await fetch("/api/admin/counties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: county.id, isLive: !county.isLive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not update market", "error");
        return;
      }
      pushToast(
        `${county.name} set ${!county.isLive ? "live" : "dark"}`,
        "success",
      );
      setCounties((prev) =>
        prev.map((c) =>
          c.id === county.id ? { ...c, isLive: !c.isLive } : c,
        ),
      );
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setBusyId(null);
    }
  }

  const liveCount = useMemo(
    () => counties.filter((c) => c.isLive).length,
    [counties],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return counties.filter((c) => {
      if (onlyLive && !c.isLive) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.country?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [counties, query, onlyLive]);

  const groups = useMemo(() => {
    const map = new Map<string, AdminCounty[]>();
    for (const c of filtered) {
      const key = c.country?.name || "Other";
      const arr = map.get(key) || [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="px-4 py-10 sm:px-8">
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md px-4 py-2 text-sm shadow-lg ${
              t.tone === "success" ? "bg-lake text-sand" : "bg-red-600 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <h1 className="font-display text-3xl font-semibold text-lake">Markets</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {liveCount} of {counties.length} counties live. Open a market to make its
        listings bookable to tourists.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search counties or countries…"
          className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={onlyLive}
            onChange={(e) => setOnlyLive(e.target.checked)}
            className="size-4 accent-lake"
          />
          Live only
        </label>
      </div>

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading markets…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          No markets match your filters.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(([country, list]) => (
            <div key={country}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {country}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/70 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            c.isLive ? "bg-lake-bright" : "bg-line"
                          }`}
                        />
                        <p className="truncate font-medium">{c.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {c._count.listings} listing
                        {c._count.listings === 1 ? "" : "s"} · {c.towns.length}{" "}
                        town{c.towns.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void toggle(c)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        c.isLive
                          ? "border border-line text-ink-muted hover:border-red-300 hover:text-red-700"
                          : "bg-lake text-sand hover:bg-lake-bright"
                      }`}
                    >
                      {c.isLive ? "Set dark" : "Go live"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
