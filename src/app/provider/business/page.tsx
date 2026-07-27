"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AmenityPicker } from "@/components/amenity-picker";
import {
  amenityLabel,
  categoriesForBusinessType,
} from "@/lib/amenities";
import { businessTypeLabel } from "@/lib/provider-verification";

type Business = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  termsAndConditions: string | null;
  isApproved: boolean;
  kycStatus?: string | null;
  businessType?: string | null;
  amenities?: string[];
  postalAddress?: string | null;
  companyEmail?: string | null;
  kraPin?: string | null;
  mpesaTillOrPaybill?: string | null;
  operatingDays?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  establishedDate?: string | null;
  website?: string | null;
  registrantRole?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  businessPermitExpiresAt?: string | null;
  traLicenceExpiresAt?: string | null;
};

export default function BusinessProfilePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [terms, setTerms] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/business");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load business profile");
      return;
    }
    const b = data.business as Business;
    setBusiness(b);
    setName(b.name || "");
    setDescription(b.description || "");
    setPhone(b.phone || "");
    setLogoUrl(b.logoUrl || "");
    setTerms(b.termsAndConditions || "");
    setAmenities(Array.isArray(b.amenities) ? b.amenities.map(String) : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUploadLogo(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("folder", "logos");
      form.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Logo upload failed");
        return;
      }
      setLogoUrl(data.url);
      setMsg("Logo uploaded — save to apply");
    } catch {
      setError("Network error uploading logo");
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/provider/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          phone,
          logoUrl: logoUrl || null,
          termsAndConditions: terms || null,
          amenities,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }
      setBusiness(data.business);
      setMsg(data.message || "Saved");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!business && !error) {
    return (
      <p className="px-4 py-10 text-sm text-ink-muted sm:px-6">
        Loading business profile…
      </p>
    );
  }

  const hours =
    business?.opensAt || business?.closesAt
      ? `${business?.opensAt || "—"} – ${business?.closesAt || "—"}`
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Business profile
      </h1>
      <p className="mt-2 text-ink-muted">
        Details from registration (type, amenities, location, KRA) sit here after
        admin approval. Listings — rooms, events, tours — are separate.
      </p>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}

      {!business ? null : (
        <>
          <section className="mt-8 rounded-xl border border-line bg-sand/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                Registered business details
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  business.isApproved
                    ? "bg-lake/15 text-lake"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {business.isApproved
                  ? "Approved"
                  : business.kycStatus || "Pending review"}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Type
                </dt>
                <dd className="text-ink">
                  {businessTypeLabel(business.businessType)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Company email
                </dt>
                <dd className="text-ink">{business.companyEmail || business.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Address
                </dt>
                <dd className="text-ink">{business.postalAddress || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  KRA PIN
                </dt>
                <dd className="text-ink">{business.kraPin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  M-Pesa till / paybill
                </dt>
                <dd className="text-ink">{business.mpesaTillOrPaybill || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Hours
                </dt>
                <dd className="text-ink">
                  {business.operatingDays || "—"}
                  {hours ? ` · ${hours}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Established
                </dt>
                <dd className="text-ink">{business.establishedDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Map pin
                </dt>
                <dd className="text-ink">
                  {business.latitude != null && business.longitude != null
                    ? `${Number(business.latitude).toFixed(5)}, ${Number(business.longitude).toFixed(5)}`
                    : "—"}
                </dd>
              </div>
            </dl>
            {(Array.isArray(business.amenities) && business.amenities.length > 0) ||
            amenities.length > 0 ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Amenities (from registration)
                </p>
                <p className="mt-2 text-sm text-ink">
                  {(amenities.length ? amenities : business.amenities || [])
                    .map((a) => amenityLabel(String(a)))
                    .join(" · ")}
                </p>
              </div>
            ) : null}
            <p className="mt-4 text-xs text-ink-muted">
              KYC docs and verification status live under{" "}
              <Link href="/provider/compliance" className="text-lake-bright underline">
                Compliance
              </Link>
              . Create rooms, events and offers under{" "}
              <Link href="/provider/listings" className="text-lake-bright underline">
                Listings
              </Link>
              .
            </p>
          </section>

          <form onSubmit={onSave} className="mt-8 space-y-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="grid size-20 place-items-center overflow-hidden rounded-xl border border-line bg-sand/40">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    className="size-full object-contain p-1.5"
                  />
                ) : (
                  <span className="text-xs text-ink-muted">No logo</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label className="block text-sm font-medium text-ink">
                  Company logo
                </label>
                <p className="mt-1 text-xs text-ink-muted">
                  Square PNG or JPG works best. Max 5 MB.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading || busy}
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => void onUploadLogo(e.target.files?.[0] ?? null)}
                />
                {logoUrl && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setLogoUrl("")}
                    className="mt-2 text-sm text-red-700 underline"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-ink">Business name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07…"
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">About the business</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                placeholder="What guests should know about your company…"
              />
            </label>

            <AmenityPicker
              categories={categoriesForBusinessType(business.businessType)}
              selected={amenities}
              onChange={setAmenities}
            />

            <label className="block">
              <span className="text-sm font-medium text-ink">
                Terms &amp; conditions
              </span>
              <p className="mt-1 text-xs text-ink-muted">
                Cancellation rules, house rules, deposit policy — shown on your
                public listings.
              </p>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={10}
                maxLength={20000}
                className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm"
                placeholder="1. Cancellation…&#10;2. Check-in…"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy || uploading}
                className="rounded-lg bg-lake px-5 py-2.5 text-sm font-semibold text-sand transition hover:bg-lake-bright disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save profile"}
              </button>
              {business.slug && (
                <Link
                  href={`/providers/${business.slug}`}
                  className="text-sm font-medium text-lake-bright hover:underline"
                >
                  View public storefront →
                </Link>
              )}
              <Link
                href="/provider/businesses"
                className="text-sm text-ink-muted hover:underline"
              >
                Switch business
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
