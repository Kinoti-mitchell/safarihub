"use client";

import { FormEvent, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LISTING_KINDS, AMENITIES } from "@/lib/amenities";

export function CatalogFilters({
  counties,
  initial,
  categorySlug,
}: {
  counties: { slug: string; name: string }[];
  initial: {
    q?: string;
    county?: string;
    minPrice?: string;
    maxPrice?: string;
    guests?: string;
    checkIn?: string;
    checkOut?: string;
    kind?: string;
    amenity?: string;
  };
  categorySlug?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const slug = categorySlug || searchParams.get("category") || "";
  const showGuests = !slug || slug === "stays" || slug === "meet";

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "q",
      "county",
      "minPrice",
      "maxPrice",
      "guests",
      "checkIn",
      "checkOut",
      "kind",
      "amenity",
    ]) {
      const v = String(form.get(key) || "").trim();
      if (v) params.set(key, v);
      else params.delete(key);
    }
    if (!showGuests) {
      params.delete("guests");
      params.delete("checkIn");
      params.delete("checkOut");
    }
    const category = searchParams.get("category");
    if (category) params.set("category", category);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clear() {
    const category = searchParams.get("category");
    startTransition(() =>
      router.push(category ? `${pathname}?category=${category}` : pathname),
    );
  }

  return (
    <form
      onSubmit={apply}
      className="mt-6 grid gap-3 border border-line/80 bg-white/70 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="block text-sm font-medium text-ink lg:col-span-2">
        Search
        <input
          name="q"
          defaultValue={initial.q || ""}
          placeholder="Name, town, provider…"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
        />
      </label>
      <label className="block text-sm font-medium text-ink">
        County
        <select
          name="county"
          defaultValue={initial.county || ""}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
        >
          <option value="">All live counties</option>
          {counties.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink">
        Listing type
        <select
          name="kind"
          defaultValue={initial.kind || ""}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
        >
          <option value="">Any (place, tour, event…)</option>
          {LISTING_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink">
        Amenity
        <select
          name="amenity"
          defaultValue={initial.amenity || ""}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
        >
          <option value="">Any amenity</option>
          {AMENITIES.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink">
        Min KES
        <input
          name="minPrice"
          type="number"
          min={0}
          defaultValue={initial.minPrice || ""}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
        />
      </label>
      <label className="block text-sm font-medium text-ink">
        Max KES
        <input
          name="maxPrice"
          type="number"
          min={0}
          defaultValue={initial.maxPrice || ""}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
        />
      </label>
      {showGuests && (
        <>
          <label className="block text-sm font-medium text-ink">
            Check-in
            <input
              name="checkIn"
              type="date"
              defaultValue={initial.checkIn || ""}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Check-out
            <input
              name="checkOut"
              type="date"
              defaultValue={initial.checkOut || ""}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Guests / seats
            <input
              name="guests"
              type="number"
              min={1}
              defaultValue={initial.guests || ""}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
            />
          </label>
        </>
      )}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-lake px-5 py-2 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md disabled:opacity-60"
        >
          {pending ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink-muted transition hover:bg-sand hover:text-ink"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
