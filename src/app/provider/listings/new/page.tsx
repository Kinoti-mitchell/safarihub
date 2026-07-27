"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LocationPicker } from "@/components/location-picker";
import { ListingCategoryPicker } from "@/components/listing-category-picker";
import {
  kindsFromCategories,
  type ListingCategoryKey,
} from "@/lib/amenities";

const STEPS = [
  { title: "Basics", blurb: "Name, category and place" },
  { title: "Photos", blurb: "Show guests the place" },
  { title: "Offers", blurb: "Rooms, tables, tickets…" },
  { title: "Map pin", blurb: "GPS for directions" },
  { title: "Preview", blurb: "Check and submit" },
] as const;

export default function NewListingSetupPage() {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ListingCategoryKey[]>(["STAY"]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [loc, setLoc] = useState({
    countryId: "",
    countyId: "",
    townId: "",
    latitude: null as number | null,
    longitude: null as number | null,
    locationConfirmed: false,
  });

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!loc.countryId || !loc.countyId || !loc.townId) {
      setError("Select country, county, and town");
      return;
    }
    if (!categories.length) {
      setError("Pick at least one category");
      return;
    }
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (title.length < 3) {
      setError("Title must be at least 3 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.get("description") || null,
          listingKinds: kindsFromCategories(categories),
          categories,
          venueTypes: [],
          countyId: loc.countyId,
          townId: loc.townId,
          address: String(form.get("address") || "").trim() || null,
          latitude: loc.latitude,
          longitude: loc.longitude,
          locationConfirmed: loc.locationConfirmed,
          amenities,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to create listing");
        return;
      }
      // Continue the same setup wizard on photos
      window.location.href = `/provider/listings/${data.listing.id}?from=new`;
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/provider/listings"
        className="text-sm text-lake-bright underline"
      >
        ← Listings
      </Link>
      <h1 className="font-display mt-4 text-3xl font-semibold text-lake">
        Set up listing
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        One flow from basics to submit — photos and prices come next.
      </p>

      <nav className="mt-8" aria-label="Setup steps">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  i === 0
                    ? "border-lake bg-lake text-sand"
                    : "border-line text-ink-muted"
                }`}
              >
                {i + 1}. {s.title}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-muted">
          Step 1 of {STEPS.length} — {STEPS[0].blurb}
        </p>
      </nav>

      <form
        onSubmit={onCreate}
        className="mt-6 space-y-5 border border-line bg-white/80 p-5 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Basics
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Name your place and where it is. Next steps are photos and offers.
          </p>
        </div>

        <label className="block text-sm font-medium text-ink">
          Name
          <input
            name="title"
            required
            minLength={3}
            placeholder="Property or experience name"
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2.5 font-normal"
          />
        </label>

        <ListingCategoryPicker
          categories={categories}
          onCategoriesChange={setCategories}
          amenities={amenities}
          onAmenitiesChange={setAmenities}
        />

        <LocationPicker
          {...loc}
          compact
          onChange={(next) => setLoc((prev) => ({ ...prev, ...next }))}
        />

        <label className="block text-sm font-medium text-ink">
          Street / landmark{" "}
          <span className="font-normal text-ink-muted">(optional)</span>
          <input
            name="address"
            placeholder="Near main stage, opposite the market…"
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2.5 font-normal"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Short description{" "}
          <span className="font-normal text-ink-muted">(optional)</span>
          <textarea
            name="description"
            placeholder="What makes this place worth booking?"
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2.5 font-normal"
            rows={3}
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-lake px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue to photos →"}
          </button>
          <Link
            href="/provider/listings"
            className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
