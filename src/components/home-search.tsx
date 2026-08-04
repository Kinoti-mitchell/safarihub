"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type County = { slug: string; name: string };
type CatOpt = { slug: string; label: string };

export type HomeSearchLabels = {
  where: string;
  wherePlaceholder: string;
  county: string;
  anywhere: string;
  anywhereIn: string;
  type: string;
  all: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  search: string;
};

const DEFAULT_LABELS: HomeSearchLabels = {
  where: "Where",
  wherePlaceholder: "Lodge, town, vibe…",
  county: "County",
  anywhere: "Anywhere",
  anywhereIn: "Anywhere",
  type: "Type",
  all: "All",
  checkIn: "Check-in",
  checkOut: "Check-out",
  guests: "Guests",
  search: "Search",
};

export function HomeSearch({
  marketName = "",
  categories = [
    { slug: "stays", label: "Stays" },
    { slug: "explore", label: "Explore" },
  ],
  labels = DEFAULT_LABELS,
}: {
  marketName?: string;
  categories?: CatOpt[];
  labels?: HomeSearchLabels;
}) {
  const router = useRouter();
  const [counties, setCounties] = useState<County[]>([]);
  const [category, setCategory] = useState("");

  useEffect(() => {
    void fetch("/api/locations?live=1")
      .then((r) => r.json())
      .then((body) => {
        setCounties(
          (body.counties || []).map((c: { slug: string; name: string }) => ({
            slug: c.slug,
            name: c.name,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const showGuests = !category || category === "stays" || category === "meet";
  const anywhereLabel = marketName.trim()
    ? labels.anywhereIn
    : labels.anywhere;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const q = String(form.get("q") || "").trim();
    const county = String(form.get("county") || "").trim();
    const guests = String(form.get("guests") || "").trim();
    const checkIn = String(form.get("checkIn") || "").trim();
    const checkOut = String(form.get("checkOut") || "").trim();
    const cat = String(form.get("category") || "").trim();
    if (q) params.set("q", q);
    if (county) params.set("county", county);
    if (cat) params.set("category", cat);
    if (guests && showGuests) params.set("guests", guests);
    if (checkIn && showGuests) params.set("checkIn", checkIn);
    if (checkOut && showGuests && (!checkIn || checkOut > checkIn)) {
      params.set("checkOut", checkOut);
    }
    const qs = params.toString();
    router.push(`/browse${qs ? `?${qs}` : ""}`);
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="block min-w-0 flex-1 text-xs font-medium text-ink-muted sm:min-w-[10rem]">
        {labels.where}
        <input
          name="q"
          placeholder={labels.wherePlaceholder}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-lake-bright"
        />
      </label>
      <label className="block text-xs font-medium text-ink-muted sm:w-40">
        {labels.county}
        <select
          name="county"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
        >
          <option value="">{anywhereLabel}</option>
          {counties.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ink-muted sm:w-36">
        {labels.type}
        <select
          name="category"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{labels.all}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {showGuests && (
        <>
          <label className="block text-xs font-medium text-ink-muted sm:w-36">
            {labels.checkIn}
            <input
              name="checkIn"
              type="date"
              min={todayISO()}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
            />
          </label>
          <label className="block text-xs font-medium text-ink-muted sm:w-36">
            {labels.checkOut}
            <input
              name="checkOut"
              type="date"
              min={todayISO()}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
            />
          </label>
          <label className="block text-xs font-medium text-ink-muted sm:w-20">
            {labels.guests}
            <input
              name="guests"
              type="number"
              min={1}
              defaultValue={2}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-lake-bright"
            />
          </label>
        </>
      )}
      <button
        type="submit"
        className="rounded-lg bg-lake px-5 py-2.5 text-sm font-semibold text-sand transition hover:bg-lake-bright sm:mb-0.5"
      >
        {labels.search}
      </button>
    </form>
  );
}
