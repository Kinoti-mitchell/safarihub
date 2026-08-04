"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { bulletsToTextarea } from "@/lib/tour-listing";

type PackageRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  days: number;
  capacity: number | null;
  meetingPoint: string | null;
  inclusions: string[] | null;
  exclusions: string[] | null;
  isPublished: boolean;
  items?: Array<{ label: string; details?: string | null }>;
};

type BookingRow = {
  id: string;
  reference: string;
  packageId: string;
  startDate: string;
  guests: number;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  guestName: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  createdAt: string;
  traveler?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export default function ProviderPackagesPage() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PackageRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/packages");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load packages");
      return;
    }
    setError(null);
    setPackages(data.packages || []);
    setBookings(data.bookings || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const itineraryRaw = String(fd.get("itinerary") || "");
    const items = itineraryRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, ...rest] = line.split("—");
        return {
          label: (label || line).trim(),
          details: rest.join("—").trim() || null,
        };
      });

    const payload = {
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim() || null,
      price: Math.round(Number(fd.get("price") || 0)),
      days: Math.max(1, Math.round(Number(fd.get("days") || 1))),
      capacity: fd.get("capacity")
        ? Math.round(Number(fd.get("capacity")))
        : null,
      meetingPoint: String(fd.get("meetingPoint") || "").trim() || null,
      inclusions: String(fd.get("inclusions") || ""),
      exclusions: String(fd.get("exclusions") || ""),
      items,
      isPublished: fd.get("isPublished") === "on",
    };

    setBusy(true);
    setError(null);
    try {
      const url = editing
        ? `/api/provider/packages/${editing.id}`
        : "/api/provider/packages";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save package");
        return;
      }
      setMsg(editing ? "Package updated" : "Package created");
      setShowForm(false);
      setEditing(null);
      form.reset();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(pkg: PackageRow) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !pkg.isPublished }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update publish state");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removePackage(pkg: PackageRow) {
    if (!confirm(`Delete package “${pkg.title}”?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/provider/packages/${pkg.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(pkg: PackageRow) {
    setEditing(pkg);
    setShowForm(true);
    setMsg(null);
  }

  const titleById = Object.fromEntries(packages.map((p) => [p.id, p.title]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Safari packages
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Multi-day itineraries with day-by-day highlights. Published packages
            appear on the public packages marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand"
        >
          {showForm ? "Close form" : "New package"}
        </button>
      </div>

      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form
          key={editing?.id || "new"}
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 grid gap-3 rounded-xl border border-line bg-white/70 p-5 sm:grid-cols-2"
        >
          <label className="block text-sm sm:col-span-2">
            Title
            <input
              name="title"
              required
              minLength={3}
              defaultValue={editing?.title || ""}
              placeholder="e.g. 3-day Masai Mara safari"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Price (KES)
            <input
              name="price"
              type="number"
              min={0}
              required
              defaultValue={editing?.price ?? ""}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Duration (days)
            <input
              name="days"
              type="number"
              min={1}
              defaultValue={editing?.days ?? 1}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Seat / vehicle capacity
            <input
              name="capacity"
              type="number"
              min={1}
              defaultValue={editing?.capacity ?? ""}
              placeholder="e.g. 6"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Meeting point
            <input
              name="meetingPoint"
              defaultValue={editing?.meetingPoint || ""}
              placeholder="e.g. Wilson Airport, 06:30"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Description
            <textarea
              name="description"
              rows={3}
              defaultValue={editing?.description || ""}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Day-by-day itinerary (one line per day — optional detail after —)
            <textarea
              name="itinerary"
              rows={4}
              defaultValue={
                editing?.items
                  ?.map((i) =>
                    i.details ? `${i.label} — ${i.details}` : i.label,
                  )
                  .join("\n") || ""
              }
              placeholder={"Day 1 — Arrive Nairobi\nDay 2 — Game drive"}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Inclusions (one per line)
            <textarea
              name="inclusions"
              rows={3}
              defaultValue={bulletsToTextarea(editing?.inclusions)}
              placeholder="Park fees&#10;Transport&#10;Guide"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Exclusions (one per line)
            <textarea
              name="exclusions"
              rows={3}
              defaultValue={bulletsToTextarea(editing?.exclusions)}
              placeholder="Flights&#10;Tips"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={editing?.isPublished ?? false}
            />
            Publish on marketplace
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create package"}
            </button>
          </div>
        </form>
      )}

      <ul className="mt-8 space-y-3">
        {packages.map((pkg) => (
          <li
            key={pkg.id}
            className="rounded-xl border border-line bg-white/70 px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-ink">
                  {pkg.title}
                </p>
                <p className="text-sm text-ink-muted">
                  {pkg.days} day{pkg.days === 1 ? "" : "s"} · KES{" "}
                  {pkg.price.toLocaleString()}
                  {pkg.capacity ? ` · cap ${pkg.capacity}` : ""} ·{" "}
                  {pkg.isPublished ? "Published" : "Draft"}
                </p>
                {pkg.meetingPoint && (
                  <p className="mt-1 text-sm text-ink-muted">
                    Meet: {pkg.meetingPoint}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {pkg.isPublished && (
                  <Link
                    href={`/packages/${pkg.slug}`}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium"
                    target="_blank"
                  >
                    View
                  </Link>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startEdit(pkg)}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void togglePublish(pkg)}
                  className="rounded-md bg-lake px-3 py-1.5 text-xs font-semibold text-sand disabled:opacity-60"
                >
                  {pkg.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removePackage(pkg)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
        {!packages.length && (
          <li className="text-sm text-ink-muted">
            No packages yet. Create a multi-day safari itinerary to sell on the
            marketplace.
          </li>
        )}
      </ul>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-lake">
          Package bookings
        </h2>
        <ul className="mt-4 space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-line bg-white/70 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {b.reference} · {titleById[b.packageId] || "Package"}
                </p>
                <p className="text-ink-muted">
                  {b.guestName || b.traveler?.name || "Guest"} ·{" "}
                  {new Date(b.startDate).toLocaleDateString("en-KE")} ·{" "}
                  {b.guests} guest{b.guests === 1 ? "" : "s"} · {b.status} ·{" "}
                  {b.paymentStatus}
                </p>
              </div>
              <p className="font-semibold text-lake">
                KES {Number(b.totalAmount).toLocaleString()}
              </p>
            </li>
          ))}
          {!bookings.length && (
            <li className="text-sm text-ink-muted">
              No package bookings yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
