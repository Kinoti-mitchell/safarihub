"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Business = {
  id: string;
  name: string;
  slug: string;
  isApproved: boolean;
  role: string;
};

export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/businesses");
    const data = await res.json();
    if (!res.ok) return;
    setBusinesses(data.businesses || []);
    setActiveId(data.activeProviderId || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchTo(providerId: string) {
    if (providerId === activeId) return;
    setBusy(true);
    const res = await fetch("/api/provider/businesses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
    });
    setBusy(false);
    if (!res.ok) return;
    setActiveId(providerId);
    router.refresh();
    window.location.reload();
  }

  if (businesses.length === 0) return null;

  const active = businesses.find((b) => b.id === activeId) || businesses[0];

  if (compact) {
    return (
      <div className="border-b border-line px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Active business
        </p>
        <select
          disabled={busy}
          value={active?.id || ""}
          onChange={(e) => void switchTo(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium text-ink"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {!b.isApproved ? " (pending)" : ""}
            </option>
          ))}
        </select>
        <Link
          href="/provider/businesses"
          className="mt-2 inline-block text-xs font-semibold text-lake-bright hover:text-lake"
        >
          Manage businesses →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Managing
          </p>
          <p className="font-display text-lg font-semibold text-ink">
            {active?.name}
          </p>
        </div>
        <Link
          href="/provider/businesses"
          className="text-sm font-semibold text-lake-bright"
        >
          {businesses.length} business{businesses.length === 1 ? "" : "es"} →
        </Link>
      </div>
      {businesses.length > 1 && (
        <select
          disabled={busy}
          value={active?.id || ""}
          onChange={(e) => void switchTo(e.target.value)}
          className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              Switch to {b.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
