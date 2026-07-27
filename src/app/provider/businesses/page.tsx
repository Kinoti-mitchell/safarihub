"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProviderVerificationFields } from "@/components/provider-verification-fields";
import {
  REGISTRANT_ROLES,
  type RegistrantRole,
} from "@/lib/provider-verification";

type Business = {
  id: string;
  name: string;
  slug: string;
  isApproved: boolean;
  role: string;
};

export default function BusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [kycType, setKycType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [registrantRole, setRegistrantRole] = useState<RegistrantRole | "">("");
  const [showVerification, setShowVerification] = useState(true);
  const [location, setLocation] = useState({
    countryId: "country_kenya",
    countyId: "",
    townId: "",
    latitude: null as number | null,
    longitude: null as number | null,
    locationConfirmed: false,
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/businesses");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load businesses");
      return;
    }
    setBusinesses(data.businesses || []);
    setActiveId(data.activeProviderId || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchTo(providerId: string) {
    setBusy(true);
    const res = await fetch("/api/provider/businesses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not switch");
      return;
    }
    setActiveId(providerId);
    router.refresh();
    window.location.href = "/provider";
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (!registrantRole) {
      setBusy(false);
      setError("Select who you are at this business.");
      return;
    }
    if (!showVerification) {
      setShowVerification(true);
      setBusy(false);
      setError("Complete business verification, then submit.");
      return;
    }
    if (!location.countyId || !location.townId) {
      setBusy(false);
      setError("Select county and town.");
      return;
    }
    if (location.latitude == null || location.longitude == null) {
      setBusy(false);
      setError("Set geolocation for the business premises.");
      return;
    }

    const form = new FormData(e.currentTarget);
    form.set("kycType", kycType);
    form.set("registrantRole", registrantRole);
    form.set("countyId", location.countyId);
    form.set("townId", location.townId);
    form.set("latitude", String(location.latitude));
    form.set("longitude", String(location.longitude));

    const res = await fetch("/api/provider/businesses", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create business");
      return;
    }
    setMsg(data.message || "Business created");
    e.currentTarget.reset();
    setShowForm(false);
    await load();
    window.location.href = "/provider";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Your businesses
      </h1>
      <p className="mt-2 text-ink-muted">
        One Safari Hub account can own and manage multiple hospitality
        businesses — hotels, restaurants, tours, transfers. Each new business
        needs verification documents before an admin can approve it.
      </p>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {businesses.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                {b.name}
                {b.id === activeId && (
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-lake-bright">
                    Active
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-muted">
                {b.role} · {b.isApproved ? "Approved" : "Awaiting approval"} · /
                {b.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.id !== activeId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void switchTo(b.id)}
                  className="rounded-md border border-lake px-3 py-1.5 text-sm font-semibold text-lake disabled:opacity-60"
                >
                  Switch to this
                </button>
              )}
              {b.id === activeId && (
                <>
                  <Link
                    href="/provider/business"
                    className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-lake-bright"
                  >
                    Edit profile
                  </Link>
                  <Link
                    href="/provider/listings"
                    className="rounded-md bg-lake px-3 py-1.5 text-sm font-semibold text-sand"
                  >
                    Manage listings
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
        {businesses.length === 0 && (
          <li className="py-6 text-sm text-ink-muted">
            No businesses yet — create your first below.
          </li>
        )}
      </ul>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand"
        >
          {showForm ? "Close" : "+ Add another business"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          encType="multipart/form-data"
          className="mt-6 space-y-4 border border-line bg-white/70 p-5"
        >
          <h2 className="font-display text-xl font-semibold">New business</h2>
          <div>
            <p className="text-sm font-medium">Who are you at this business? *</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REGISTRANT_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRegistrantRole(r.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${
                    registrantRole === r.value
                      ? "border-lake bg-lake text-sand"
                      : "border-line bg-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="registrantRole" value={registrantRole} />
          </div>
          <label className="block text-sm font-medium">
            Business name
            <input
              name="name"
              required
              minLength={2}
              placeholder="e.g. Coast Lodge Mombasa"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Phone
            <input
              name="phone"
              type="tel"
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ["INDIVIDUAL", "Individual"],
                ["COMPANY", "Company"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKycType(value)}
                className={`rounded-lg border px-3 py-2 font-medium transition ${
                  kycType === value
                    ? "border-lake bg-lake text-sand"
                    : "border-line bg-white text-ink hover:border-lake-bright"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {kycType === "INDIVIDUAL" ? (
            <label className="block text-sm font-medium">
              National ID number
              <input
                name="idNumber"
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          ) : (
            <label className="block text-sm font-medium">
              Registration number
              <input
                name="registrationNumber"
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => setShowVerification((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-lake/40 bg-white px-3 py-2.5 text-left text-sm font-semibold text-lake"
          >
            <span>
              {showVerification ? "Hide" : "Show"} verification details
            </span>
            <span aria-hidden>{showVerification ? "−" : "+"}</span>
          </button>

          {showVerification && (
            <ProviderVerificationFields
              kycType={kycType}
              location={location}
              onLocationChange={(next) =>
                setLocation((prev) => ({ ...prev, ...next }))
              }
            />
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {busy ? "Creating…" : "Submit for verification"}
          </button>
        </form>
      )}
    </div>
  );
}
