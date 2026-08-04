"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AmenityPicker } from "@/components/amenity-picker";
import {
  amenityLabel,
  categoriesForBusinessType,
} from "@/lib/amenities";
import {
  businessTypeLabel,
  registrantRoleLabel,
} from "@/lib/provider-verification";

type Director = {
  name: string;
  idNumber?: string | null;
  role?: string | null;
};

type Owner = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  memberSince?: string | null;
  nationalId?: string | null;
  registrantRole?: string | null;
  idDocUrl?: string | null;
  selfieDocUrl?: string | null;
};

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
  kycType?: string | null;
  idNumber?: string | null;
  registrationNumber?: string | null;
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
  countyId?: string | null;
  townId?: string | null;
  countyName?: string | null;
  townName?: string | null;
  directors?: Director[];
  otherDocsUrls?: string[];
  ownerIdDocUrl?: string | null;
  kraPinDocUrl?: string | null;
  registrationCertUrl?: string | null;
  businessPermitUrl?: string | null;
  kycDocUrl?: string | null;
  selfieDocUrl?: string | null;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  phoneVerifiedAt?: string | null;
  emailVerifiedAt?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  createdAt?: string | null;
};

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-ink">{value || "—"}</dd>
    </div>
  );
}

function DocLink({
  label,
  url,
}: {
  label: string;
  url?: string | null;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm">
      <span className="text-ink">{label}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-lake-bright underline underline-offset-2"
        >
          View
        </a>
      ) : (
        <span className="text-ink-muted">Not uploaded</span>
      )}
    </li>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = value.slice(0, 10);
  return d || "—";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function BusinessProfilePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [platformName, setPlatformName] = useState("Platform");
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
    setOwner((data.owner as Owner | null) || null);
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

  useEffect(() => {
    void fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        if (d.platformName) setPlatformName(String(d.platformName));
      })
      .catch(() => {});
  }, []);

  async function onUploadLogo(file: File | null) {
    if (!file || !business?.isApproved) return;
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
    if (!business?.isApproved) return;
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

  if (!business) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  const approved = Boolean(business.isApproved);
  const hours =
    business.opensAt || business.closesAt
      ? `${business.opensAt || "—"} – ${business.closesAt || "—"}`
      : null;
  const locationLabel = [business.townName, business.countyName]
    .filter(Boolean)
    .join(", ");
  const amenityList = (
    Array.isArray(business.amenities) ? business.amenities : []
  ).map((a) => amenityLabel(String(a)));
  const directors = Array.isArray(business.directors) ? business.directors : [];
  const otherDocs = Array.isArray(business.otherDocsUrls)
    ? business.otherDocsUrls
    : [];
  const isCompany = (business.kycType || "").toUpperCase() === "COMPANY";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Business profile
      </h1>
      <p className="mt-2 text-ink-muted">
        Everything submitted at registration. Editing unlocks after admin
        approval.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-lg border border-lake/30 bg-lake/5 px-3 py-2 text-sm text-lake">
          {msg}
        </p>
      )}

      {!approved && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Awaiting admin approval</p>
          <p className="mt-1">
            This profile is read-only until an admin approves the business. You
            can review the details below or update documents under{" "}
            <Link
              href="/provider/compliance"
              className="font-medium underline underline-offset-2"
            >
              Compliance
            </Link>
            .
          </p>
          {business.rejectionReason && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              Rejection reason: {business.rejectionReason}
            </p>
          )}
        </div>
      )}

      <section className="mt-8 space-y-6">
        <div className="rounded-xl border border-line bg-sand/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                {business.name}
              </h2>
              <p className="text-sm text-ink-muted">/{business.slug}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                approved
                  ? "bg-lake/15 text-lake"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {approved ? "Approved" : business.kycStatus || "Pending review"}
            </span>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <Field
              label="Registration type"
              value={isCompany ? "Limited company" : "Individual / sole trader"}
            />
            <Field
              label="Your role"
              value={registrantRoleLabel(business.registrantRole)}
            />
            <Field
              label="Business type"
              value={businessTypeLabel(business.businessType)}
            />
            <Field
              label="Registered"
              value={formatDateTime(business.createdAt)}
            />
            {isCompany ? (
              <Field
                label="Company registration no."
                value={business.registrationNumber}
              />
            ) : (
              <Field label="National ID" value={business.idNumber} />
            )}
            <Field label="Business phone" value={business.phone} />
            <Field
              label="Company email"
              value={business.companyEmail || business.email}
            />
            <Field
              label="Website"
              value={
                business.website ? (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lake-bright underline underline-offset-2"
                  >
                    {business.website}
                  </a>
                ) : (
                  "—"
                )
              }
            />
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-5">
          <h3 className="text-sm font-semibold text-ink">Owner details</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Account holder who registered this business on {platformName}.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field
              label="Full name"
              value={owner?.name || "—"}
            />
            <Field
              label="Role at business"
              value={registrantRoleLabel(
                owner?.registrantRole || business.registrantRole,
              )}
            />
            <Field label="Login email" value={owner?.email || "—"} />
            <Field
              label="Phone"
              value={owner?.phone || business.phone || "—"}
            />
            <Field
              label="National ID"
              value={owner?.nationalId || business.idNumber || "—"}
            />
            <Field
              label="Account created"
              value={formatDateTime(owner?.memberSince)}
            />
          </dl>
          <ul className="mt-4 space-y-2">
            <DocLink
              label="Owner national ID document"
              url={owner?.idDocUrl || business.ownerIdDocUrl}
            />
            <DocLink
              label="Selfie holding ID"
              url={owner?.selfieDocUrl || business.selfieDocUrl}
            />
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-5">
          <h3 className="text-sm font-semibold text-ink">Location & hours</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Postal / physical address" value={business.postalAddress} full />
            <Field label="County / town" value={locationLabel || "—"} />
            <Field
              label="Map pin"
              value={
                business.latitude != null && business.longitude != null
                  ? `${Number(business.latitude).toFixed(5)}, ${Number(business.longitude).toFixed(5)}`
                  : "—"
              }
            />
            <Field label="Operating days" value={business.operatingDays} />
            <Field label="Hours" value={hours} />
            <Field
              label="Date started operating"
              value={formatDate(business.establishedDate)}
            />
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-5">
          <h3 className="text-sm font-semibold text-ink">Tax & payouts</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="KRA PIN" value={business.kraPin} />
            <Field
              label="M-Pesa till / paybill"
              value={business.mpesaTillOrPaybill}
            />
            <Field
              label="Permit / TRA expiry"
              value={formatDate(business.businessPermitExpiresAt)}
            />
            <Field
              label="TRA licence expiry"
              value={formatDate(business.traLicenceExpiresAt)}
            />
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-5">
          <h3 className="text-sm font-semibold text-ink">Amenities</h3>
          <p className="mt-3 text-sm text-ink">
            {amenityList.length > 0 ? amenityList.join(" · ") : "—"}
          </p>
        </div>

        {directors.length > 0 && (
          <div className="rounded-xl border border-line bg-white/70 p-5">
            <h3 className="text-sm font-semibold text-ink">Directors</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {directors.map((d, i) => (
                <li
                  key={`${d.name}-${i}`}
                  className="rounded-lg border border-line px-3 py-2"
                >
                  <p className="font-medium text-ink">{d.name}</p>
                  <p className="text-ink-muted">
                    {[d.role, d.idNumber ? `ID ${d.idNumber}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-line bg-white/70 p-5">
          <h3 className="text-sm font-semibold text-ink">
            Verification documents
          </h3>
          <ul className="mt-3 space-y-2">
            <DocLink label="Owner national ID" url={business.ownerIdDocUrl} />
            <DocLink
              label="Selfie holding ID"
              url={business.selfieDocUrl}
            />
            <DocLink label="KRA PIN document" url={business.kraPinDocUrl} />
            {isCompany && (
              <DocLink
                label="Certificate of incorporation"
                url={business.registrationCertUrl}
              />
            )}
            <DocLink
              label="Business permit / tourism licence"
              url={business.businessPermitUrl}
            />
            {isCompany && (
              <DocLink
                label="CR12 / supporting document"
                url={business.kycDocUrl}
              />
            )}
            {otherDocs.map((url, i) => (
              <DocLink key={url} label={`Other document ${i + 1}`} url={url} />
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-5">
          <h3 className="text-sm font-semibold text-ink">Agreements & OTP</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field
              label="Terms accepted"
              value={formatDateTime(business.termsAcceptedAt)}
            />
            <Field
              label="Privacy accepted"
              value={formatDateTime(business.privacyAcceptedAt)}
            />
            <Field
              label="Phone OTP verified"
              value={formatDateTime(business.phoneVerifiedAt)}
            />
            <Field
              label="Email OTP verified"
              value={formatDateTime(business.emailVerifiedAt)}
            />
          </dl>
        </div>
      </section>

      {approved ? (
        <form onSubmit={onSave} className="mt-10 space-y-6 border-t border-line pt-8">
          <div>
            <h2 className="font-display text-xl font-semibold text-lake">
              Public profile (editable)
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Logo, about text, amenities and guest-facing terms — available
              after approval.
            </p>
          </div>

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
                onChange={(e) =>
                  void onUploadLogo(e.target.files?.[0] ?? null)
                }
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
            <span className="text-sm font-medium text-ink">
              About the business
            </span>
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
      ) : (
        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6 text-sm">
          <Link
            href="/provider/compliance"
            className="rounded-lg border border-lake px-4 py-2 font-semibold text-lake"
          >
            Open compliance
          </Link>
          <Link
            href="/provider/businesses"
            className="rounded-lg border border-line px-4 py-2 font-medium text-ink hover:border-lake-bright"
          >
            Switch business
          </Link>
        </div>
      )}
    </div>
  );
}
