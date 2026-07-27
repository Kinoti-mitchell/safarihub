"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  LISTING_CATEGORY_KEYS,
  kindsFromCategories,
  type ListingCategoryKey,
  type ListingKindKey,
} from "@/lib/amenities";

type AmenityRow = {
  id: string;
  category: string;
  name: string;
  slug: string;
};

type Props = {
  categories: ListingCategoryKey[];
  onCategoriesChange: (next: ListingCategoryKey[]) => void;
  /** Selected amenity slugs stored on listing.amenities */
  amenities?: string[];
  onAmenitiesChange?: (next: string[]) => void;
  onListingKindsChange?: (next: ListingKindKey[]) => void;
};

/**
 * Category first. Only one category’s amenity list is open at a time —
 * picking the next category closes the previous list and opens the new one.
 */
export function ListingCategoryPicker({
  categories,
  onCategoriesChange,
  amenities = [],
  onAmenitiesChange,
  onListingKindsChange,
}: Props) {
  const [rows, setRows] = useState<AmenityRow[]>([]);
  const [openCategory, setOpenCategory] = useState<ListingCategoryKey>(
    categories[0] || "STAY",
  );
  const catSet = new Set(categories);
  const selected = new Set(amenities.map((a) => a.toLowerCase()));

  useEffect(() => {
    void fetch("/api/category-labels")
      .then((r) => r.json())
      .then((d) => setRows(d.labels || []))
      .catch(() => setRows([]));
  }, []);

  // Keep open panel on a still-selected category
  useEffect(() => {
    if (!categories.length) return;
    if (!categories.includes(openCategory)) {
      setOpenCategory(categories[categories.length - 1]!);
    }
  }, [categories, openCategory]);

  const visible = useMemo(() => {
    if (!openCategory) return [];
    const filtered = rows.filter(
      (r) => r.category === "ALL" || r.category === openCategory,
    );
    const bySlug = new Map<string, AmenityRow>();
    for (const r of filtered) {
      const key = r.slug.toLowerCase();
      const prev = bySlug.get(key);
      if (!prev || (prev.category === "ALL" && r.category !== "ALL")) {
        bySlug.set(key, r);
      }
    }
    return Array.from(bySlug.values());
  }, [rows, openCategory]);

  const available = useMemo(
    () => visible.filter((row) => !selected.has(row.slug.toLowerCase())),
    [visible, selected],
  );

  const selectedRows = useMemo(() => {
    const bySlug = new Map(
      rows.map((r) => [r.slug.toLowerCase(), r] as const),
    );
    return amenities.map((slug) => {
      const row = bySlug.get(slug.toLowerCase());
      return (
        row || {
          id: slug,
          category: "",
          name: slug.replace(/_/g, " "),
          slug,
        }
      );
    });
  }, [amenities, rows]);

  function selectCategory(key: ListingCategoryKey) {
    // Always open this category’s amenities (closes the previous panel)
    setOpenCategory(key);

    if (!catSet.has(key)) {
      const list = LISTING_CATEGORY_KEYS.filter(
        (k) => catSet.has(k) || k === key,
      );
      onCategoriesChange(list);
      onListingKindsChange?.(kindsFromCategories(list));
    }
  }

  function removeCategory(key: ListingCategoryKey) {
    if (categories.length <= 1) return;
    const list = categories.filter((c) => c !== key);
    onCategoriesChange(list);
    onListingKindsChange?.(kindsFromCategories(list));

    if (openCategory === key) {
      setOpenCategory(list[list.length - 1]!);
    }

    if (onAmenitiesChange && amenities.length) {
      const keep = new Set(list);
      const stillValid = amenities.filter((slug) => {
        const meta = rows.find(
          (r) => r.slug.toLowerCase() === slug.toLowerCase(),
        );
        if (!meta) return false;
        return (
          meta.category === "ALL" ||
          keep.has(meta.category as ListingCategoryKey)
        );
      });
      if (stillValid.length !== amenities.length) {
        onAmenitiesChange(stillValid);
      }
    }
  }

  function toggleAmenity(slug: string) {
    if (!onAmenitiesChange) return;
    const key = slug.toLowerCase();
    if (selected.has(key)) {
      onAmenitiesChange(amenities.filter((a) => a.toLowerCase() !== key));
    } else {
      onAmenitiesChange([...amenities, slug].slice(0, 40));
    }
  }

  const openLabel = CATEGORY_LABELS[openCategory]?.split(" (")[0] || openCategory;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-ink">Category</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Tap a category to open its amenities. Move to the next category when
          you are done — the previous list closes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LISTING_CATEGORY_KEYS.map((key) => {
            const on = catSet.has(key);
            const open = openCategory === key;
            const label = CATEGORY_LABELS[key].split(" (")[0];
            return (
              <div key={key} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => selectCategory(key)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    open
                      ? "border-lake bg-lake text-sand"
                      : on
                        ? "border-lake bg-lake/15 text-lake"
                        : "border-line bg-white text-ink-muted hover:border-lake-bright"
                  }`}
                >
                  {label}
                  {on && !open ? " ✓" : ""}
                </button>
                {on && categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCategory(key)}
                    className="ml-1 text-xs text-ink-muted hover:text-red-700"
                    title={`Remove ${label}`}
                    aria-label={`Remove ${label}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {onAmenitiesChange && (
        <div>
          <p className="text-sm font-medium text-ink">
            Amenities — {openLabel}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Pick what guests get for {openLabel}. Then tap another category
            above for its list.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => toggleAmenity(row.slug)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-lake-bright"
              >
                {row.name}
              </button>
            ))}
            {available.length === 0 && visible.length === 0 && (
              <p className="text-xs text-ink-muted">
                No amenities for {openLabel} yet — ask an admin to add some.
              </p>
            )}
            {available.length === 0 && visible.length > 0 && (
              <p className="text-xs text-ink-muted">
                All {openLabel} amenities are selected. Tap another category
                when ready.
              </p>
            )}
          </div>

          {selectedRows.length > 0 ? (
            <div className="mt-4 border border-lake/25 bg-lake/5 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-lake">
                Selected ({selectedRows.length})
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                From all categories — saved when you submit.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {selectedRows.map((row) => (
                  <li key={row.slug}>
                    <button
                      type="button"
                      onClick={() => toggleAmenity(row.slug)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-lake bg-lake px-3 py-1.5 text-xs font-medium text-sand"
                      title="Remove"
                    >
                      {row.name}
                      <span aria-hidden className="opacity-80">
                        ×
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">
              No amenities selected yet — tap options above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
