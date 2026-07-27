"use client";

import {
  amenitiesForCategories,
  type AmenityDef,
} from "@/lib/amenities";

export function AmenityPicker({
  category,
  categories,
  selected,
  onChange,
  amenities,
}: {
  /** @deprecated Prefer `categories` for multi-select listings. */
  category?: string | null;
  categories?: string[] | null;
  selected: string[];
  onChange: (next: string[]) => void;
  /** Override list; defaults to catalog filtered by categories. */
  amenities?: AmenityDef[];
}) {
  const list =
    amenities ??
    amenitiesForCategories(
      categories?.length ? categories : category ? [category] : null,
    );
  const set = new Set(selected);

  function toggle(key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">Facilities &amp; extras</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        What guests get on site — Wi‑Fi, parking, pool, spa, etc. (Not the same
        as category: category is Stay/Eat/…; this is amenities.)
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {list.map((a) => {
          const on = set.has(a.key);
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => toggle(a.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? "border-lake bg-lake text-sand"
                  : "border-line bg-white text-ink-muted hover:border-lake-bright"
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
      {list.length === 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Pick a category above to see relevant facilities.
        </p>
      )}
    </div>
  );
}
