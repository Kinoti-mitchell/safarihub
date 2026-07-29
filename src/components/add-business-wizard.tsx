"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ProviderBusinessDetailsSection,
  ProviderDocumentsSection,
  ProviderLocationSection,
} from "@/components/provider-verification-fields";
import { AmenityPicker } from "@/components/amenity-picker";
import {
  amenityLabel,
  categoriesForBusinessType,
} from "@/lib/amenities";
import {
  REGISTRANT_ROLES,
  type RegistrantRole,
} from "@/lib/provider-verification";
import { checkIdentityFields } from "@/lib/check-identity-client";

const STEPS = [
  { id: "role", label: "Role" },
  { id: "location", label: "Location" },
  { id: "business", label: "Business" },
  { id: "documents", label: "Documents" },
  { id: "amenities", label: "Amenities" },
  { id: "review", label: "Review" },
] as const;

const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30";

const fieldErrorClass =
  "mt-1 w-full rounded-lg border border-red-400 bg-white px-3 py-2 font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-xs font-medium text-red-700">{message}</span>
  );
}

function inputClass(hasError: boolean) {
  return hasError ? fieldErrorClass : fieldClass;
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-1.5">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li
            key={s.id}
            className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide ${
              active
                ? "bg-lake text-sand"
                : done
                  ? "bg-lake/15 text-lake"
                  : "bg-sand text-ink-muted"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        );
      })}
    </ol>
  );
}

type Props = {
  onCancel: () => void;
  onCreated: (message: string) => void;
  accountEmail?: string | null;
  accountPhone?: string | null;
};

export function AddBusinessWizard({
  onCancel,
  onCreated,
  accountEmail,
  accountPhone,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [checkingIdentity, setCheckingIdentity] = useState(false);

  const [kycType, setKycType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [registrantRole, setRegistrantRole] = useState<RegistrantRole | "">("");
  const [businessType, setBusinessType] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [location, setLocation] = useState({
    countryId: "country_kenya",
    countyId: "",
    townId: "",
    latitude: null as number | null,
    longitude: null as number | null,
    locationConfirmed: false,
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [otpChannel, setOtpChannel] = useState<"phone" | "email" | null>(null);
  const [phoneOtpId, setPhoneOtpId] = useState<string | null>(null);
  const [emailOtpId, setEmailOtpId] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneDevCode, setPhoneDevCode] = useState<string | null>(null);
  const [emailDevCode, setEmailDevCode] = useState<string | null>(null);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const contactVerified = phoneVerified || emailVerified;
  const maxStep = STEPS.length - 1;
  const amenityCategories = categoriesForBusinessType(businessType);

  function validateStep(current: number): {
    message: string | null;
    fields: Record<string, string>;
  } {
    const form = formRef.current;
    const fields: Record<string, string> = {};
    if (!form) return { message: "Form not ready", fields };

    if (current === 0) {
      if (!registrantRole) {
        fields.registrantRole =
          "Select who you are at this business (owner, manager, ICT, etc.)";
      }
      const name = String(new FormData(form).get("name") || "").trim();
      if (name.length < 2) fields.name = "Enter the business / venue name";
      if (kycType === "INDIVIDUAL") {
        const id = String(new FormData(form).get("idNumber") || "").trim();
        if (id.length < 3) fields.idNumber = "Enter the national ID number";
      } else {
        const reg = String(
          new FormData(form).get("registrationNumber") || "",
        ).trim();
        if (reg.length < 3) {
          fields.registrationNumber =
            "Enter the company registration number";
        }
      }
    } else if (current === 1) {
      const address = String(
        new FormData(form).get("postalAddress") || "",
      ).trim();
      if (address.length < 5) {
        fields.postalAddress = "Enter postal / physical address";
      }
      if (!location.countyId || !location.townId) {
        fields.location =
          "Select county and town so the map can show your place";
      } else if (location.latitude == null || location.longitude == null) {
        fields.location =
          "Map pin missing — choose a town or use GPS at the premises";
      }
    } else if (current === 2) {
      const companyEmail = String(
        new FormData(form).get("companyEmail") || "",
      ).trim();
      const kraPin = String(new FormData(form).get("kraPin") || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]/g, "");
      const bt = String(new FormData(form).get("businessType") || "").trim();
      const establishedDate = String(
        new FormData(form).get("establishedDate") || "",
      ).trim();
      const mpesa = String(
        new FormData(form).get("mpesaTillOrPaybill") || "",
      ).trim();
      if (!companyEmail.includes("@")) fields.companyEmail = "Enter company email";
      if (!/^[A-Z]\d{9}[A-Z]$/.test(kraPin)) {
        fields.kraPin = "Enter a valid KRA PIN (e.g. A123456789Z)";
      }
      if (!bt) fields.businessType = "Select business type";
      if (!establishedDate) {
        fields.establishedDate =
          "Enter the date the business started operating";
      }
      if (mpesa.replace(/\D/g, "").length < 5) {
        fields.mpesaTillOrPaybill =
          "Enter M-Pesa till or paybill (at least 5 digits)";
      }
      const opensAt = String(new FormData(form).get("opensAt") || "").trim();
      const closesAt = String(new FormData(form).get("closesAt") || "").trim();
      if (!opensAt || !closesAt) fields.opensAt = "Set opening and closing times";
      if (bt) setBusinessType(bt);
    } else if (current === 3) {
      const requiredDocs: Array<[string, string]> = [
        ["ownerIdDoc", "Upload the owner's national ID"],
        ["selfieDoc", "Upload a selfie holding your national ID"],
        ["kraPinDoc", "Upload the KRA PIN document"],
        ["businessPermit", "Upload the business permit / tourism licence"],
      ];
      if (kycType === "COMPANY") {
        requiredDocs.push(
          ["registrationCert", "Upload the certificate of incorporation"],
          ["kycDoc", "Upload the CR12 / supporting document"],
        );
      }
      for (const [name, message] of requiredDocs) {
        const input = form.querySelector<HTMLInputElement>(
          `input[name="${name}"]`,
        );
        if (!input?.files?.length) {
          fields[name] =
            `${message} (re-select files if you refreshed the page)`;
        }
      }
      const expiry = String(
        new FormData(form).get("businessPermitExpiresAt") || "",
      ).trim();
      if (!expiry) {
        fields.businessPermitExpiresAt = "Enter permit / TRA expiry date";
      }
    } else if (current === 4) {
      if (amenities.length < 1) {
        fields.amenities = "Select at least one amenity your business offers";
      }
    } else if (current === 5) {
      if (!termsAccepted) {
        fields.termsAccepted = "Accept the Terms of Service to continue";
      }
      if (!privacyAccepted) {
        fields.privacyAccepted = "Accept the Privacy Policy to continue";
      }
      if (!otpChannel) {
        fields.otpChannel = "Choose SMS or email verification at the bottom";
      } else if (!contactVerified) {
        fields.otp =
          otpChannel === "phone"
            ? "Send the SMS code and verify the phone before submitting"
            : "Send the email code and verify the email before submitting";
      }
    }

    return { message: Object.values(fields)[0] || null, fields };
  }

  async function identityPayloadForStep(current: number) {
    const form = formRef.current;
    if (!form) return null;
    const fd = new FormData(form);
    if (current === 0) {
      return {
        phone: String(fd.get("phone") || "").trim() || undefined,
        idNumber:
          kycType === "INDIVIDUAL"
            ? String(fd.get("idNumber") || "").trim()
            : undefined,
        registrationNumber:
          kycType === "COMPANY"
            ? String(fd.get("registrationNumber") || "").trim()
            : undefined,
      };
    }
    if (current === 1) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
    if (current === 2) {
      return { kraPin: String(fd.get("kraPin") || "").trim() };
    }
    return null;
  }

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function goNext() {
    const local = validateStep(step);
    if (local.message) {
      setFieldErrors(local.fields);
      setError(local.message);
      return;
    }

    const identityInput = await identityPayloadForStep(step);
    if (identityInput) {
      setCheckingIdentity(true);
      try {
        const check = await checkIdentityFields(identityInput);
        if (!check.ok) {
          setFieldErrors(check.fieldErrors);
          setError(
            Object.values(check.fieldErrors)[0] ||
              "This detail is already registered",
          );
          return;
        }
      } finally {
        setCheckingIdentity(false);
      }
    }

    setError(null);
    setFieldErrors({});
    setStep((s) => Math.min(s + 1, maxStep));
  }

  function goBack() {
    setError(null);
    setFieldErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function sendOtp(channel: "phone" | "email") {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const destination =
      channel === "phone"
        ? String(fd.get("phone") || accountPhone || "").trim()
        : String(fd.get("companyEmail") || accountEmail || "").trim();

    if (channel === "phone" && destination.replace(/\D/g, "").length < 10) {
      setError("Enter a valid business phone first (Role step)");
      return;
    }
    if (channel === "email" && !destination.includes("@")) {
      setError("Enter company email on the Business step first");
      return;
    }

    setError(null);
    if (channel === "phone") setSendingPhoneOtp(true);
    else setSendingEmailOtp(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, destination, purpose: "signup" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send verification code");
        return;
      }
      const fill = data.testCode || data.devCode;
      if (channel === "phone") {
        setPhoneOtpId(data.otpId);
        setPhoneVerified(false);
        setPhoneDevCode(fill || null);
        if (fill) setPhoneCode(String(fill).replace(/\D/g, "").slice(0, 6));
      } else {
        setEmailOtpId(data.otpId);
        setEmailVerified(false);
        setEmailDevCode(fill || null);
        if (fill) setEmailCode(String(fill).replace(/\D/g, "").slice(0, 6));
      }
    } catch {
      setError("Network error — could not send code");
    } finally {
      if (channel === "phone") setSendingPhoneOtp(false);
      else setSendingEmailOtp(false);
    }
  }

  async function verifyOtpChannel(channel: "phone" | "email") {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const destination =
      channel === "phone"
        ? String(fd.get("phone") || accountPhone || "").trim()
        : String(fd.get("companyEmail") || accountEmail || "").trim();
    const otpId = channel === "phone" ? phoneOtpId : emailOtpId;
    const code = (channel === "phone" ? phoneCode : emailCode).replace(
      /\D/g,
      "",
    );

    if (!otpId) {
      setError(`Send a code to your ${channel} first`);
      return;
    }
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }

    setError(null);
    if (channel === "phone") setVerifyingPhone(true);
    else setVerifyingEmail(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpId, code, destination }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid verification code");
        return;
      }
      if (channel === "phone") {
        setPhoneVerified(true);
        setEmailVerified(false);
      } else {
        setEmailVerified(true);
        setPhoneVerified(false);
      }
    } catch {
      setError("Network error — could not verify code");
    } finally {
      if (channel === "phone") setVerifyingPhone(false);
      else setVerifyingEmail(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < maxStep) {
      await goNext();
      return;
    }

    setBusy(true);
    setError(null);
    setFieldErrors({});

    for (let s = 0; s <= maxStep; s++) {
      const local = validateStep(s);
      if (local.message) {
        setBusy(false);
        setStep(s);
        setFieldErrors(local.fields);
        setError(local.message);
        return;
      }
      const identityInput = await identityPayloadForStep(s);
      if (identityInput) {
        const check = await checkIdentityFields(identityInput);
        if (!check.ok) {
          setBusy(false);
          setStep(s);
          setFieldErrors(check.fieldErrors);
          setError(
            Object.values(check.fieldErrors)[0] ||
              "This detail is already registered",
          );
          return;
        }
      }
    }

    const form = new FormData(e.currentTarget);
    form.set("kycType", kycType);
    form.set("registrantRole", registrantRole);
    form.set("countyId", location.countyId);
    form.set("townId", location.townId);
    form.set("latitude", String(location.latitude));
    form.set("longitude", String(location.longitude));
    form.set("termsAccepted", termsAccepted ? "true" : "");
    form.set("privacyAccepted", privacyAccepted ? "true" : "");
    form.set("phoneOtpId", phoneVerified ? phoneOtpId || "" : "");
    form.set("emailOtpId", emailVerified ? emailOtpId || "" : "");
    form.set("amenities", JSON.stringify(amenities));

    try {
      const res = await fetch("/api/provider/businesses", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Could not create business";
        setError(msg);
        if (/upload|document|selfie|permit|KRA PIN document|CR12|incorporation/i.test(msg)) {
          setStep(3);
        } else if (/OTP|verif/i.test(msg)) {
          setStep(5);
        }
        return;
      }
      onCreated(data.message || "Business created");
    } catch {
      setError("Network error — could not create business");
    } finally {
      setBusy(false);
    }
  }

  const reviewSummary = useMemo(() => {
    if (step !== maxStep || !formRef.current) return null;
    const fd = new FormData(formRef.current);
    const roleLabel =
      REGISTRANT_ROLES.find((r) => r.value === registrantRole)?.label ||
      registrantRole;
    return {
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || accountPhone || "").trim(),
      roleLabel,
      kycType,
      registrationNumber: String(fd.get("registrationNumber") || "").trim(),
      postalAddress: String(fd.get("postalAddress") || "").trim(),
      companyEmail: String(fd.get("companyEmail") || "").trim(),
      kraPin: String(fd.get("kraPin") || "").trim(),
      businessType: String(fd.get("businessType") || "").trim(),
      mpesa: String(fd.get("mpesaTillOrPaybill") || "").trim(),
      amenities: amenities.map((a) => amenityLabel(a)),
    };
  }, [step, maxStep, registrantRole, kycType, amenities, accountPhone]);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => void onSubmit(e)}
      onInput={(e) => {
        const t = e.target;
        if (
          t instanceof HTMLInputElement ||
          t instanceof HTMLSelectElement ||
          t instanceof HTMLTextAreaElement
        ) {
          if (t.name) clearFieldError(t.name);
        }
      }}
      encType="multipart/form-data"
      className="mt-6 space-y-4 rounded-xl border border-line bg-white/80 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-lake">
            Add another business
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Same verification flow as signup — complete each step, then submit
            for review.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <Stepper step={step} />

      {/* Step 0 — Role & identity */}
      <div className={step === 0 ? "space-y-8" : "hidden"}>
        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">
            1. What is the business called?
          </p>
          <label className="block text-sm text-ink-muted">
            Business / venue name *
            <input
              name="name"
              required={step === 0}
              placeholder="e.g. Coast Lodge Mombasa"
              className={inputClass(Boolean(fieldErrors.name))}
            />
            <FieldError message={fieldErrors.name} />
          </label>
          <label className="block text-sm text-ink-muted">
            Business phone
            <input
              name="phone"
              type="tel"
              defaultValue={accountPhone || ""}
              placeholder="07XX XXX XXX"
              className={inputClass(Boolean(fieldErrors.phone))}
            />
            <FieldError message={fieldErrors.phone} />
            {!fieldErrors.phone && (
              <span className="mt-1 block text-xs font-normal text-ink-muted">
                Used for SMS OTP on the review step
              </span>
            )}
          </label>
        </section>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">
            2. How is it registered?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: "INDIVIDUAL" as const,
                  title: "Individual / sole trader",
                  body: "Uses a national ID number",
                },
                {
                  value: "COMPANY" as const,
                  title: "Limited company",
                  body: "Needs a company registration number (PVT-…)",
                },
              ] as const
            ).map((opt) => {
              const selected = kycType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setKycType(opt.value)}
                  className={`rounded-xl border px-4 py-3.5 text-left transition ${
                    selected
                      ? "border-lake bg-lake/5 ring-2 ring-lake/25"
                      : "border-line bg-white hover:border-lake-bright"
                  }`}
                >
                  <span className="block text-sm font-semibold text-ink">
                    {opt.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {opt.body}
                  </span>
                </button>
              );
            })}
          </div>
          {kycType === "INDIVIDUAL" ? (
            <label className="mt-2 block text-sm font-medium text-ink">
              National ID number *
              <input
                name="idNumber"
                required={step === 0}
                className={inputClass(Boolean(fieldErrors.idNumber))}
              />
              <FieldError message={fieldErrors.idNumber} />
            </label>
          ) : (
            <label className="mt-2 block text-sm font-medium text-ink">
              Company registration number *
              <input
                name="registrationNumber"
                required={step === 0}
                placeholder="e.g. PVT-XXXXXXX"
                className={inputClass(Boolean(fieldErrors.registrationNumber))}
              />
              <FieldError message={fieldErrors.registrationNumber} />
            </label>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">
            3. Who are you at this company?
          </p>
          <label className="block text-sm text-ink-muted">
            Your role *
            <select
              name="registrantRole"
              required={step === 0}
              value={registrantRole}
              onChange={(e) => {
                clearFieldError("registrantRole");
                setRegistrantRole(
                  (e.target.value || "") as RegistrantRole | "",
                );
              }}
              className={inputClass(Boolean(fieldErrors.registrantRole))}
            >
              <option value="">Select your role…</option>
              {REGISTRANT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.registrantRole} />
          </label>
        </section>
      </div>

      {/* Step 1 — Location */}
      <div className={step === 1 ? "block" : "hidden"}>
        <ProviderLocationSection
          location={location}
          onLocationChange={(next) => {
            clearFieldError("location");
            clearFieldError("postalAddress");
            setLocation((prev) => ({ ...prev, ...next }));
          }}
          errors={{
            postalAddress: fieldErrors.postalAddress,
            location: fieldErrors.location,
          }}
        />
      </div>

      {/* Step 2 — Business details */}
      <div
        className={step === 2 ? "block" : "hidden"}
        onChange={(e) => {
          const t = e.target;
          if (t instanceof HTMLSelectElement && t.name === "businessType") {
            setBusinessType(t.value);
          }
        }}
      >
        <ProviderBusinessDetailsSection
          kycType={kycType}
          errors={{
            companyEmail: fieldErrors.companyEmail,
            kraPin: fieldErrors.kraPin,
            businessType: fieldErrors.businessType,
            mpesaTillOrPaybill: fieldErrors.mpesaTillOrPaybill,
            establishedDate: fieldErrors.establishedDate,
            opensAt: fieldErrors.opensAt,
            closesAt: fieldErrors.closesAt,
          }}
        />
      </div>

      {/* Step 3 — Documents */}
      <div className={step === 3 ? "block" : "hidden"}>
        <ProviderDocumentsSection kycType={kycType} />
      </div>

      {/* Step 4 — Amenities */}
      <div className={step === 4 ? "space-y-4" : "hidden"}>
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Amenities at your business
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Tick what guests get on site. You can refine these later on each
            listing.
          </p>
        </div>
        <AmenityPicker
          categories={amenityCategories}
          selected={amenities}
          onChange={setAmenities}
        />
        <input
          type="hidden"
          name="amenities"
          value={JSON.stringify(amenities)}
        />
        {amenities.length > 0 && (
          <p className="text-xs text-ink-muted">{amenities.length} selected</p>
        )}
      </div>

      {/* Step 5 — Review */}
      <div className={step === 5 ? "space-y-4" : "hidden"}>
        <div>
          <h2 className="font-display text-xl font-semibold text-lake">
            Review before submitting
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Check your details, accept terms, then verify with a one-time code.
          </p>
        </div>

        {reviewSummary && (
          <dl className="space-y-2 rounded-lg border border-line bg-white/60 p-4 text-sm">
            <div className="grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Business
                </dt>
                <dd className="text-ink">{reviewSummary.name}</dd>
                <dd className="text-ink-muted">{reviewSummary.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Role
                </dt>
                <dd className="text-ink">{reviewSummary.roleLabel}</dd>
                <dd className="text-ink-muted">
                  {reviewSummary.kycType === "COMPANY"
                    ? `Company · ${reviewSummary.registrationNumber || "—"}`
                    : "Individual (National ID)"}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Location
              </dt>
              <dd className="text-ink">{reviewSummary.postalAddress || "—"}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Details
                </dt>
                <dd className="text-ink-muted">{reviewSummary.companyEmail}</dd>
                <dd className="text-ink-muted">
                  KRA {reviewSummary.kraPin || "—"} ·{" "}
                  {reviewSummary.businessType || "—"}
                </dd>
                <dd className="text-ink-muted">
                  M-Pesa {reviewSummary.mpesa || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Amenities
                </dt>
                <dd className="text-ink-muted">
                  {reviewSummary.amenities.length > 0
                    ? reviewSummary.amenities.join(" · ")
                    : "—"}
                </dd>
              </div>
            </div>
          </dl>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 size-4 accent-lake"
          />
          <span className="text-ink">
            I accept the{" "}
            <Link
              href="/legal/terms"
              target="_blank"
              className="font-medium text-lake-bright underline underline-offset-2"
            >
              Terms of Service
            </Link>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
            className="mt-0.5 size-4 accent-lake"
          />
          <span className="text-ink">
            I accept the{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              className="font-medium text-lake-bright underline underline-offset-2"
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        <div className="space-y-4 border-t border-line pt-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Verify with a one-time code *
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              SMS uses the business phone; email uses the company email from the
              Business step.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setOtpChannel("phone");
                setError(null);
                setPhoneVerified(false);
                setEmailVerified(false);
                setPhoneOtpId(null);
                setEmailOtpId(null);
                setPhoneCode("");
                setEmailCode("");
                setPhoneDevCode(null);
                setEmailDevCode(null);
              }}
              className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                otpChannel === "phone"
                  ? "border-lake bg-lake text-sand"
                  : "border-line bg-white text-ink hover:border-lake-bright"
              }`}
            >
              SMS to phone
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpChannel("email");
                setError(null);
                setPhoneVerified(false);
                setEmailVerified(false);
                setPhoneOtpId(null);
                setEmailOtpId(null);
                setPhoneCode("");
                setEmailCode("");
                setPhoneDevCode(null);
                setEmailDevCode(null);
              }}
              className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                otpChannel === "email"
                  ? "border-lake bg-lake text-sand"
                  : "border-line bg-white text-ink hover:border-lake-bright"
              }`}
            >
              Email code
            </button>
          </div>

          {otpChannel === "phone" && (
            <div className="space-y-3 rounded-lg border border-line bg-white/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">SMS verification</p>
                {phoneVerified && (
                  <span className="rounded-full bg-lake/15 px-2 py-0.5 text-xs font-semibold text-lake">
                    Verified
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void sendOtp("phone")}
                disabled={sendingPhoneOtp || phoneVerified}
                className="rounded-lg border border-lake px-3 py-2 text-sm font-semibold text-lake transition hover:bg-lake/5 disabled:opacity-60"
              >
                {sendingPhoneOtp
                  ? "Sending…"
                  : phoneOtpId
                    ? "Resend SMS code"
                    : "Send SMS code"}
              </button>
              {phoneDevCode && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                  Local test code:{" "}
                  <span className="font-mono font-semibold">{phoneDevCode}</span>
                </p>
              )}
              {phoneOtpId && !phoneVerified && (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    maxLength={8}
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    className={`${fieldClass} mt-0 flex-1 min-w-[8rem]`}
                  />
                  <button
                    type="button"
                    onClick={() => void verifyOtpChannel("phone")}
                    disabled={
                      verifyingPhone ||
                      phoneCode.replace(/\D/g, "").length !== 6
                    }
                    className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                  >
                    {verifyingPhone ? "Checking…" : "Verify"}
                  </button>
                </div>
              )}
            </div>
          )}

          {otpChannel === "email" && (
            <div className="space-y-3 rounded-lg border border-line bg-white/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">
                  Email verification
                </p>
                {emailVerified && (
                  <span className="rounded-full bg-lake/15 px-2 py-0.5 text-xs font-semibold text-lake">
                    Verified
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void sendOtp("email")}
                disabled={sendingEmailOtp || emailVerified}
                className="rounded-lg border border-lake px-3 py-2 text-sm font-semibold text-lake transition hover:bg-lake/5 disabled:opacity-60"
              >
                {sendingEmailOtp
                  ? "Sending…"
                  : emailOtpId
                    ? "Resend email code"
                    : "Send email code"}
              </button>
              {emailDevCode && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                  Local test code:{" "}
                  <span className="font-mono font-semibold">{emailDevCode}</span>
                </p>
              )}
              {emailOtpId && !emailVerified && (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    maxLength={8}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    className={`${fieldClass} mt-0 flex-1 min-w-[8rem]`}
                  />
                  <button
                    type="button"
                    onClick={() => void verifyOtpChannel("email")}
                    disabled={
                      verifyingEmail ||
                      emailCode.replace(/\D/g, "").length !== 6
                    }
                    className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                  >
                    {verifyingEmail ? "Checking…" : "Verify"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          type="hidden"
          name="termsAccepted"
          value={termsAccepted ? "true" : ""}
        />
        <input
          type="hidden"
          name="privacyAccepted"
          value={privacyAccepted ? "true" : ""}
        />
        <input
          type="hidden"
          name="phoneOtpId"
          value={phoneVerified ? phoneOtpId || "" : ""}
        />
        <input
          type="hidden"
          name="emailOtpId"
          value={emailVerified ? emailOtpId || "" : ""}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-lake-bright disabled:opacity-60"
          >
            Back
          </button>
        )}
        {step < maxStep ? (
          <button
            type="button"
            onClick={() => void goNext()}
            disabled={checkingIdentity}
            className="flex-1 rounded-lg bg-lake py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright disabled:opacity-60"
          >
            {checkingIdentity ? "Checking…" : "Continue"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-lake py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        )}
      </div>
    </form>
  );
}
