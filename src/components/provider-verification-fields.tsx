"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/location-picker";
import {
  BUSINESS_TYPES,
  DIRECTOR_ROLES,
  OPERATING_DAY_OPTIONS,
  type CompanyDirector,
} from "@/lib/provider-verification";

export type LocState = {
  countryId: string;
  countyId: string;
  townId: string;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
};

const acceptDocs = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30";

const fieldErrorClass =
  "mt-1 w-full rounded-lg border border-red-400 bg-white px-3 py-2 font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30";

function FieldHint({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>;
  }
  if (hint) {
    return <span className="mt-1 block text-xs font-normal text-ink-muted">{hint}</span>;
  }
  return null;
}

function DocField({
  name,
  label,
  hint,
  required,
  multiple,
}: {
  name: string;
  label: string;
  hint: string;
  required?: boolean;
  multiple?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      {required ? " *" : " (optional)"}
      <input
        name={name}
        type="file"
        accept={acceptDocs}
        required={required}
        multiple={multiple}
        className="mt-1 block w-full text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-lake/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-lake"
      />
      <span className="mt-1 block text-xs font-normal text-ink-muted">
        {hint}
      </span>
    </label>
  );
}

export function ProviderLocationSection({
  location,
  onLocationChange,
  showPostal = true,
  errors,
}: {
  location: LocState;
  onLocationChange: (next: Partial<LocState>) => void;
  showPostal?: boolean;
  errors?: Partial<Record<"postalAddress" | "location" | "countyId" | "townId", string>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Where is the business?</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Pick county and town, then confirm on the map. Use GPS if you are at
          the premises.
        </p>
      </div>

      {showPostal && (
        <label className="block text-sm font-medium text-ink">
          Postal / physical address *
          <textarea
            name="postalAddress"
            required
            rows={2}
            minLength={5}
            placeholder="P.O. Box or street address"
            className={errors?.postalAddress ? fieldErrorClass : fieldClass}
          />
          <FieldHint error={errors?.postalAddress} />
        </label>
      )}

      <LocationPicker
        countryId={location.countryId}
        countyId={location.countyId}
        townId={location.townId}
        latitude={location.latitude}
        longitude={location.longitude}
        locationConfirmed={location.locationConfirmed}
        mapClassName="h-72 w-full"
        onChange={(next) => onLocationChange(next)}
      />
      {(errors?.location || errors?.countyId || errors?.townId) && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {errors.location || errors.countyId || errors.townId}
        </p>
      )}
      <input type="hidden" name="countyId" value={location.countyId} />
      <input type="hidden" name="townId" value={location.townId} />
      <input type="hidden" name="latitude" value={location.latitude ?? ""} />
      <input type="hidden" name="longitude" value={location.longitude ?? ""} />
    </div>
  );
}

export function ProviderBusinessDetailsSection({
  kycType,
  errors,
}: {
  kycType: "INDIVIDUAL" | "COMPANY";
  errors?: Partial<Record<"companyEmail" | "kraPin" | "businessType" | "mpesaTillOrPaybill" | "establishedDate" | "opensAt" | "closesAt", string>>;
}) {
  const [directors, setDirectors] = useState<CompanyDirector[]>(
    kycType === "COMPANY" ? [{ name: "", idNumber: "", role: "Director" }] : [],
  );

  function updateDirector(index: number, patch: Partial<CompanyDirector>) {
    setDirectors((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  function addDirector() {
    if (directors.length >= 10) return;
    setDirectors((prev) => [
      ...prev,
      { name: "", idNumber: "", role: "Director" },
    ]);
  }

  function removeDirector(index: number) {
    setDirectors((prev) => prev.filter((_, i) => i !== index));
  }

  const directorsPayload = directors
    .map((d) => ({
      name: d.name.trim(),
      idNumber: d.idNumber?.trim() || null,
      role: d.role?.trim() || null,
    }))
    .filter((d) => d.name.length >= 2);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Business details</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Contact, tax, hours, and directors for admin review.
        </p>
      </div>

      <label className="block text-sm font-medium text-ink">
        Company / business email *
        <input
          name="companyEmail"
          type="email"
          required
          autoComplete="organization"
          placeholder="bookings@yourlodge.co.ke"
          className={errors?.companyEmail ? fieldErrorClass : fieldClass}
        />
        <FieldHint error={errors?.companyEmail} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Company website (optional)
        <input
          name="website"
          type="text"
          inputMode="url"
          placeholder="https://yourlodge.co.ke"
          className={fieldClass}
        />
      </label>

      <label className="block text-sm font-medium text-ink">
        KRA PIN *
        <input
          name="kraPin"
          required
          autoComplete="off"
          placeholder="A123456789Z"
          pattern="[A-Za-z]\d{9}[A-Za-z]"
          title="Kenyan KRA PIN, e.g. A123456789Z"
          className={`${errors?.kraPin ? fieldErrorClass : fieldClass} uppercase`}
        />
        <FieldHint
          error={errors?.kraPin}
          hint="Letter + 9 digits + letter, e.g. A123456789Z"
        />
      </label>

      <label className="block text-sm font-medium text-ink">
        Type of business *
        <select
          name="businessType"
          required
          defaultValue=""
          className={errors?.businessType ? fieldErrorClass : fieldClass}
        >
          <option value="" disabled>
            Select type…
          </option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <FieldHint error={errors?.businessType} />
      </label>

      <label className="block text-sm font-medium text-ink">
        M-Pesa till or paybill *
        <input
          name="mpesaTillOrPaybill"
          required
          inputMode="numeric"
          placeholder="e.g. 522522 or Till 123456"
          className={errors?.mpesaTillOrPaybill ? fieldErrorClass : fieldClass}
        />
        <FieldHint
          error={errors?.mpesaTillOrPaybill}
          hint="Used for payouts and to confirm the business receives money"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Days of operation *
          <select
            name="operatingDays"
            required
            defaultValue="Mon-Sun"
            className={fieldClass}
          >
            {OPERATING_DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">
          Date started operating *
          <input
            name="establishedDate"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            className={errors?.establishedDate ? fieldErrorClass : fieldClass}
          />
          <FieldHint error={errors?.establishedDate} />
        </label>
        <label className="block text-sm font-medium text-ink">
          Opens at *
          <input
            name="opensAt"
            type="time"
            required
            defaultValue="08:00"
            className={errors?.opensAt ? fieldErrorClass : fieldClass}
          />
          <FieldHint error={errors?.opensAt} />
        </label>
        <label className="block text-sm font-medium text-ink">
          Closes at *
          <input
            name="closesAt"
            type="time"
            required
            defaultValue="20:00"
            className={errors?.closesAt ? fieldErrorClass : fieldClass}
          />
          <FieldHint error={errors?.closesAt} />
        </label>
      </div>

      <div className="space-y-3 rounded-lg border border-line bg-white/60 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">
              Company directors {kycType === "COMPANY" ? "" : "(if any)"}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Optional — list directors or partners if the business has them.
            </p>
          </div>
          <button
            type="button"
            onClick={addDirector}
            disabled={directors.length >= 10}
            className="rounded-md border border-lake px-2.5 py-1 text-xs font-semibold text-lake disabled:opacity-50"
          >
            + Add director
          </button>
        </div>

        {directors.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No directors added.{" "}
            <button
              type="button"
              onClick={addDirector}
              className="font-medium text-lake-bright underline"
            >
              Add one
            </button>
          </p>
        ) : (
          <ul className="space-y-3">
            {directors.map((d, i) => (
              <li
                key={i}
                className="space-y-2 rounded-md border border-line bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Director {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDirector(i)}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <label className="block text-sm font-medium text-ink">
                  Full name
                  <input
                    value={d.name}
                    onChange={(e) => updateDirector(i, { name: e.target.value })}
                    placeholder="As on national ID / CR12"
                    className={fieldClass}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-ink">
                    National ID (optional)
                    <input
                      value={d.idNumber || ""}
                      onChange={(e) =>
                        updateDirector(i, { idNumber: e.target.value })
                      }
                      inputMode="numeric"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Role
                    <select
                      value={d.role || "Director"}
                      onChange={(e) =>
                        updateDirector(i, { role: e.target.value })
                      }
                      className={fieldClass}
                    >
                      {DIRECTOR_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
        <input
          type="hidden"
          name="directors"
          value={JSON.stringify(directorsPayload)}
        />
      </div>
    </div>
  );
}

export function ProviderDocumentsSection({
  kycType,
}: {
  kycType: "INDIVIDUAL" | "COMPANY";
}) {
  const isCompany = kycType === "COMPANY";
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">Verification documents</h3>
        <p className="mt-1 text-xs text-ink-muted">
          JPEG, PNG or PDF · max 8 MB each.
          {isCompany
            ? " Company filings (incorporation + CR12) are required."
            : " Incorporation and CR12 are only required for companies."}
        </p>
      </div>
      <DocField
        name="ownerIdDoc"
        label="Owner national ID"
        required
        hint="Photo or PDF of the owner's national ID"
      />
      <DocField
        name="selfieDoc"
        label="Selfie holding your ID"
        required
        hint="Clear photo of your face while holding the same national ID"
      />
      <DocField
        name="kraPinDoc"
        label="KRA PIN"
        required
        hint="Scan or PDF of the KRA PIN certificate"
      />
      {isCompany && (
        <DocField
          name="registrationCert"
          label="Certificate of incorporation"
          required
          hint="Company certificate of incorporation / business registration"
        />
      )}
      <DocField
        name="businessPermit"
        label="Business permit / tourism licence"
        required
        hint="County business permit or Tourism Regulatory Authority licence"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Permit / TRA expiry date *
          <input
            name="businessPermitExpiresAt"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          TRA licence expiry (optional)
          <input
            name="traLicenceExpiresAt"
            type="date"
            className={fieldClass}
          />
        </label>
      </div>
      {isCompany && (
        <DocField
          name="kycDoc"
          label="CR12 / supporting document"
          required
          hint="CR12, lease agreement, or director affidavit"
        />
      )}
      <DocField
        name="otherDocs"
        label="Other documents"
        multiple
        hint="Optional — select multiple extra files if needed"
      />
    </div>
  );
}

/** Full block for “add business” forms (non-stepped). */
export function ProviderVerificationFields({
  kycType,
  location,
  onLocationChange,
  className = "",
}: {
  kycType: "INDIVIDUAL" | "COMPANY";
  location: LocState;
  onLocationChange: (next: Partial<LocState>) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      <ProviderLocationSection
        location={location}
        onLocationChange={onLocationChange}
      />
      <ProviderBusinessDetailsSection kycType={kycType} />
      <ProviderDocumentsSection kycType={kycType} />
    </div>
  );
}
