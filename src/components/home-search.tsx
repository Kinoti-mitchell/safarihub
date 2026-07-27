"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

type County = { slug: string; name: string };

export function HomeSearch({ marketName = "Kenya" }: { marketName?: string }) {
  const router = useRouter();
  const [counties, setCounties] = useState<County[]>([]);
  const [category, setCategory] = useState("");

  useEffect(() => {
    void fetch("/api/locations")
      .then((r) => r.json())
      .then(async (d) => {
        const kenya = (d.countries || []).find(
          (c: { code?: string; slug?: string }) =>
            c.code === "KE" || c.slug === "kenya",
        );
        if (!kenya) return;
        const res = await fetch(`/api/locations?countryId=${kenya.id}`);
        const body = await res.json();
        setCounties(
          (body.counties || [])
            .filter((c: { isLive?: boolean }) => c.isLive !== false)
            .map((c: { slug: string; name: string }) => ({
              slug: c.slug,
              name: c.name,
            })),
        );
      })
      .catch(() => undefined);
  }, []);

  const showGuests = !category || category === "stays" || category === "meet";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const q = String(form.get("q") || "").trim();
    const county = String(form.get("county") || "").trim();
    const guests = String(form.get("guests") || "").trim();
    const cat = String(form.get("category") || "").trim();
    if (q) params.set("q", q);
    if (county) params.set("county", county);
    if (cat) params.set("category", cat);
    if (guests && showGuests) params.set("guests", guests);
    const qs = params.toString();
    router.push(`/browse${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="block min-w-0 flex-1 text-xs font-medium text-ink-muted sm:min-w-[10rem]">
        Where
        <input
          name="q"
          placeholder="Lodge, town, vibe…"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-lake-bright"
        />
      </label>
      <label className="block text-xs font-medium text-ink-muted sm:w-40">
        County
        <select
          name="county"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
        >
          <option value="">Anywhere in {marketName}</option>
          {counties.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ink-muted sm:w-36">
        Type
        <select
          name="category"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {showGuests && (
        <label className="block text-xs font-medium text-ink-muted sm:w-20">
          Guests
          <input
            name="guests"
            type="number"
            min={1}
            defaultValue={2}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
          />
        </label>
      )}
      <button
        type="submit"
        className="rounded-lg bg-lake px-5 py-2.5 text-sm font-semibold text-sand transition hover:bg-lake-bright sm:mb-0.5"
      >
        Search
      </button>
    </form>
  );
}
