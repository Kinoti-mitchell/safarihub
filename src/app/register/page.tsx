"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { createTabBind, writeTabBind } from "@/lib/tab-session";

const DRAFT_KEY = "safari_hub_provider_signup_v3";

const PROVIDER_STEPS = [
  { id: "account", label: "Account" },
  { id: "role", label: "Role" },
  { id: "location", label: "Location" },
  { id: "business", label: "Business" },
  { id: "documents", label: "Documents" },
  { id: "amenities", label: "Amenities" },
  { id: "review", label: "Review" },
] as const;

type ProviderSignupDraft = {
  version: 3;
  step: number;
  asProvider: boolean;
  kycType: "INDIVIDUAL" | "COMPANY";
  registrantRole: RegistrantRole | "";
  location: {
    countryId: string;
    countyId: string;
    townId: string;
    latitude: number | null;
    longitude: number | null;
    locationConfirmed: boolean;
  };
  phoneOtpId: string | null;
  emailOtpId: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  otpChannel: "phone" | "email" | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  amenities: string[];
  fields: Record<string, string>;
};

type Toast = { id: number; message: string; tone: "success" | "error" };

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

const SERIALIZABLE_SKIP = new Set([
  "termsAccepted",
  "privacyAccepted",
  "phoneOtpId",
  "emailOtpId",
]);

function Stepper({
  step,
  steps,
}: {
  step: number;
  steps: readonly { id: string; label: string }[];
}) {
  return (
    <ol className="mb-6 flex flex-wrap gap-1.5">
      {steps.map((s, i) => {
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

function applyFieldsToForm(
  form: HTMLFormElement,
  fields: Record<string, string>,
) {
  for (const [name, value] of Object.entries(fields)) {
    const el = form.elements.namedItem(name);
    if (el instanceof RadioNodeList) continue;
    if (el instanceof HTMLInputElement) {
      if (el.type === "file" || el.type === "checkbox" || el.type === "hidden") {
        continue;
      }
      el.value = value;
    } else if (el instanceof HTMLTextAreaElement) {
      el.value = value;
    } else if (el instanceof HTMLSelectElement) {
      el.value = value;
    }
  }
}

function collectSerializableFields(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement)) {
      if (el instanceof HTMLTextAreaElement && el.name) {
        out[el.name] = el.value;
      } else if (el instanceof HTMLSelectElement && el.name) {
        out[el.name] = el.value;
      }
      continue;
    }
    if (!el.name || el.type === "file" || el.type === "checkbox") continue;
    if (SERIALIZABLE_SKIP.has(el.name)) continue;
    out[el.name] = el.value;
  }
  return out;
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const defaultProvider = params.get("role") === "provider";
  const callbackUrl = params.get("callbackUrl") || params.get("next") || "";
  const formRef = useRef<HTMLFormElement>(null);
  const draftHydrated = useRef(false);

  const [allowSelfSignup, setAllowSelfSignup] = useState(true);
  const [minPasswordLength, setMinPasswordLength] = useState(6);
  const [platformName, setPlatformName] = useState("Platform");
  const [platformReady, setPlatformReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [asProvider, setAsProvider] = useState(defaultProvider);
  const [step, setStep] = useState(0);
  const [kycType, setKycType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [registrantRole, setRegistrantRole] = useState<RegistrantRole | "">(
    "",
  );
  const [location, setLocation] = useState({
    countryId: "country_kenya",
    countyId: "",
    townId: "",
    latitude: null as number | null,
    longitude: null as number | null,
    locationConfirmed: false,
  });

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

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState("");
  const [otpChannel, setOtpChannel] = useState<"phone" | "email" | null>(null);

  const contactVerified = phoneVerified || emailVerified;

  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/platform");
        const data = await res.json();
        if (cancelled) return;
        setAllowSelfSignup(data.allowSelfSignup !== false);
        if (data.platformName) setPlatformName(String(data.platformName));
        setMinPasswordLength(
          Number(data.minPasswordLength) > 0
            ? Number(data.minPasswordLength)
            : 6,
        );
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setPlatformReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxStep = asProvider ? PROVIDER_STEPS.length - 1 : 0;
  const steps = useMemo(
    () => (asProvider ? PROVIDER_STEPS : [{ id: "account", label: "Account" }]),
    [asProvider],
  );

  const buildDraft = useCallback(
    (nextStep: number): ProviderSignupDraft | null => {
      const form = formRef.current;
      if (!form || !asProvider) return null;
      return {
        version: 3,
        step: nextStep,
        asProvider: true,
        kycType,
        registrantRole,
        location,
        phoneOtpId,
        emailOtpId,
        phoneVerified,
        emailVerified,
        otpChannel,
        termsAccepted,
        privacyAccepted,
        amenities,
        fields: collectSerializableFields(form),
      };
    },
    [
      asProvider,
      kycType,
      registrantRole,
      location,
      phoneOtpId,
      emailOtpId,
      phoneVerified,
      emailVerified,
      otpChannel,
      termsAccepted,
      privacyAccepted,
      amenities,
    ],
  );

  const persistDraftLocal = useCallback(
    (nextStep: number) => {
      const draft = buildDraft(nextStep);
      if (!draft) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* ignore quota errors */
      }
    },
    [buildDraft],
  );

  useEffect(() => {
    if (draftHydrated.current) return;
    draftHydrated.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as ProviderSignupDraft;
      if (draft.version !== 3) return;

      setAsProvider(draft.asProvider ?? true);
      setStep(draft.step ?? 0);
      setKycType(draft.kycType ?? "INDIVIDUAL");
      setRegistrantRole(draft.registrantRole ?? "");
      if (draft.location) setLocation(draft.location);
      setPhoneOtpId(draft.phoneOtpId ?? null);
      setEmailOtpId(draft.emailOtpId ?? null);
      setPhoneVerified(draft.phoneVerified ?? false);
      setEmailVerified(draft.emailVerified ?? false);
      setOtpChannel(draft.otpChannel ?? null);
      setTermsAccepted(draft.termsAccepted ?? false);
      setPrivacyAccepted(draft.privacyAccepted ?? false);
      setAmenities(Array.isArray(draft.amenities) ? draft.amenities : []);
      if (draft.fields?.businessType) {
        setBusinessType(draft.fields.businessType);
      }

      requestAnimationFrame(() => {
        if (formRef.current && draft.fields) {
          applyFieldsToForm(formRef.current, draft.fields);
          const bt = formRef.current.elements.namedItem("businessType");
          if (bt instanceof HTMLSelectElement || bt instanceof HTMLInputElement) {
            setBusinessType(bt.value);
          }
        }
      });
    } catch {
      /* ignore corrupt draft */
    }
  }, []);

  function validateStep(current: number): {
    message: string | null;
    fields: Record<string, string>;
  } {
    const form = formRef.current;
    const fields: Record<string, string> = {};
    if (!form) return { message: "Form not ready", fields };

    if (current === 0) {
      const firstName = String(new FormData(form).get("firstName") || "").trim();
      const lastName = String(new FormData(form).get("lastName") || "").trim();
      const idNumber = String(new FormData(form).get("idNumber") || "").trim();
      const email = String(new FormData(form).get("email") || "").trim();
      const password = String(new FormData(form).get("password") || "");
      const phone = String(new FormData(form).get("phone") || "").trim();
      if (firstName.length < 2) fields.firstName = "Enter your first name";
      if (lastName.length < 2) fields.lastName = "Enter your last name";
      if (!email.includes("@")) fields.email = "Enter a valid email";
      if (phone.replace(/\D/g, "").length < 10) {
        fields.phone = "Enter a valid Kenyan phone (at least 10 digits)";
      }
      if (asProvider && idNumber.length < 3) {
        fields.idNumber = "Enter your national ID number";
      }
      if (password.length < minPasswordLength) {
        fields.password = `Password must be at least ${minPasswordLength} characters`;
      }
    } else if (current === 1) {
      if (!registrantRole) {
        fields.registrantRole =
          "Select who you are at this business (owner, manager, ICT, etc.)";
      }
      const businessName = String(
        new FormData(form).get("businessName") || "",
      ).trim();
      if (businessName.length < 2) {
        fields.businessName = "Enter the business / venue name";
      }
      if (kycType === "COMPANY") {
        const reg = String(
          new FormData(form).get("registrationNumber") || "",
        ).trim();
        if (reg.length < 3) {
          fields.registrationNumber =
            "Enter the company registration number";
        }
      }
    } else if (current === 2) {
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
    } else if (current === 3) {
      const companyEmail = String(
        new FormData(form).get("companyEmail") || "",
      ).trim();
      const kraPin = String(new FormData(form).get("kraPin") || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]/g, "");
      const bt = String(
        new FormData(form).get("businessType") || "",
      ).trim();
      const establishedDate = String(
        new FormData(form).get("establishedDate") || "",
      ).trim();
      if (!companyEmail.includes("@")) {
        fields.companyEmail = "Enter company email";
      }
      if (!/^[A-Z]\d{9}[A-Z]$/.test(kraPin)) {
        fields.kraPin = "Enter a valid KRA PIN (e.g. A123456789Z)";
      }
      if (!bt) fields.businessType = "Select business type";
      if (!establishedDate) {
        fields.establishedDate =
          "Enter the date the business started operating";
      }
      const opensAt = String(new FormData(form).get("opensAt") || "").trim();
      const closesAt = String(new FormData(form).get("closesAt") || "").trim();
      if (!opensAt || !closesAt) {
        fields.opensAt = "Set opening and closing times";
      }
      if (bt) setBusinessType(bt);
    } else if (current === 4) {
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
    } else if (current === 5) {
      if (amenities.length < 1) {
        fields.amenities = "Select at least one amenity your business offers";
      }
    } else if (current === 6) {
      if (!termsAccepted) {
        fields.termsAccepted = "Accept the Terms of Service to continue";
      }
      if (!privacyAccepted) {
        fields.privacyAccepted = "Accept the Privacy Policy to continue";
      }
      if (!otpChannel) {
        fields.otpChannel =
          "Choose SMS or email verification at the bottom";
      } else if (!contactVerified) {
        fields.otp =
          otpChannel === "phone"
            ? "Send the SMS code and verify your phone before submitting"
            : "Send the email code and verify your email before submitting";
      }
    }

    const message = Object.values(fields)[0] || null;
    return { message, fields };
  }

  async function identityPayloadForStep(
    current: number,
  ): Promise<Parameters<typeof checkIdentityFields>[0] | null> {
    const form = formRef.current;
    if (!form) return null;
    const fd = new FormData(form);

    if (current === 0) {
      return {
        email: String(fd.get("email") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        idNumber: asProvider
          ? String(fd.get("idNumber") || "").trim()
          : undefined,
      };
    }
    if (current === 1 && kycType === "COMPANY") {
      return {
        registrationNumber: String(
          fd.get("registrationNumber") || "",
        ).trim(),
      };
    }
    if (current === 2) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
    if (current === 3) {
      return {
        kraPin: String(fd.get("kraPin") || "").trim(),
      };
    }
    return null;
  }

  async function goNext() {
    setError(null);
    const local = validateStep(step);
    if (local.message) {
      setFieldErrors(local.fields);
      setError(local.message);
      scrollToFirstError(local.fields);
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
          scrollToFirstError(check.fieldErrors);
          return;
        }
      } finally {
        setCheckingIdentity(false);
      }
    }

    setFieldErrors({});
    const nextStep = Math.min(step + 1, maxStep);
    if (asProvider) persistDraftLocal(nextStep);
    setStep(nextStep);
  }

  function scrollToFirstError(fields: Record<string, string>) {
    const first = Object.keys(fields)[0];
    if (!first || !formRef.current) return;
    const name =
      first === "location" ? "postalAddress" : first === "otp" ? "phoneOtpId" : first;
    const el = formRef.current.querySelector<HTMLElement>(
      `[name="${name}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      el.focus({ preventScroll: true });
    }
  }

  function goBack() {
    setError(null);
    setFieldErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function sendOtp(channel: "phone" | "email") {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const destination =
      channel === "phone"
        ? String(fd.get("phone") || "").trim()
        : String(fd.get("email") || "").trim();
    if (channel === "phone" && destination.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone on the Account step first");
      return;
    }
    if (channel === "email" && !destination.includes("@")) {
      setError("Enter a valid email on the Account step first");
      return;
    }

    setError(null);
    if (channel === "phone") setSendingPhoneOtp(true);
    else setSendingEmailOtp(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, destination }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send verification code");
        return;
      }
      if (channel === "phone") {
        setPhoneOtpId(data.otpId);
        setPhoneVerified(false);
        setPhoneDevCode(data.testCode || data.devCode || null);
        // Prefer fixed test code so slow signup flows don't expire mid-test
        const fill = data.testCode || data.devCode;
        if (fill) setPhoneCode(String(fill).replace(/\D/g, "").slice(0, 6));
      } else {
        setEmailOtpId(data.otpId);
        setEmailVerified(false);
        setEmailDevCode(data.testCode || data.devCode || null);
        const fill = data.testCode || data.devCode;
        if (fill) setEmailCode(String(fill).replace(/\D/g, "").slice(0, 6));
      }
      pushToast(
        data.testCode
          ? `Use test code ${data.testCode} (always valid in local dev)`
          : data.devCode
            ? `Code ready (dev: ${data.devCode})`
            : data.message || "Verification code sent",
        "success",
      );
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
        ? String(fd.get("phone") || "").trim()
        : String(fd.get("email") || "").trim();
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
        if (data.otpId) setPhoneOtpId(data.otpId);
      } else {
        setEmailVerified(true);
        setPhoneVerified(false);
        if (data.otpId) setEmailOtpId(data.otpId);
      }
      pushToast(
        channel === "phone" ? "Phone verified" : "Email verified",
        "success",
      );
    } catch {
      setError("Network error — could not verify code");
    } finally {
      if (channel === "phone") setVerifyingPhone(false);
      else setVerifyingEmail(false);
    }
  }

  async function saveAndFinishLater() {
    const form = formRef.current;
    if (!form || !asProvider) return;

    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    if (!email.includes("@")) {
      setError("Enter a valid email before saving");
      return;
    }

    setSavingDraft(true);
    setError(null);
    persistDraftLocal(step);

    try {
      const payload = collectSerializableFields(form);
      const res = await fetch("/api/auth/register-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, step, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save progress");
        return;
      }
      pushToast(data.message || "Progress saved — finish anytime", "success");
    } catch {
      setError("Network error — could not save progress");
    } finally {
      setSavingDraft(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (asProvider && step < maxStep) {
      await goNext();
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});
    const formEl = e.currentTarget;

    if (asProvider) {
      // Re-check every step — file inputs are cleared after refresh/draft restore
      for (let s = 0; s <= maxStep; s++) {
        const local = validateStep(s);
        if (local.message) {
          setLoading(false);
          setStep(s);
          setFieldErrors(local.fields);
          setError(local.message);
          return;
        }
        const identityInput = await identityPayloadForStep(s);
        if (identityInput) {
          const check = await checkIdentityFields(identityInput);
          if (!check.ok) {
            setLoading(false);
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
    } else {
      const local = validateStep(0);
      if (local.message) {
        setLoading(false);
        setFieldErrors(local.fields);
        setError(local.message);
        return;
      }
      const check = await checkIdentityFields({
        email: String(new FormData(formEl).get("email") || "").trim(),
        phone: String(new FormData(formEl).get("phone") || "").trim(),
      });
      if (!check.ok) {
        setLoading(false);
        setFieldErrors(check.fieldErrors);
        setError(
          Object.values(check.fieldErrors)[0] ||
            "This detail is already registered",
        );
        return;
      }
    }

    const form = new FormData(formEl);
    const firstName = String(form.get("firstName") || "").trim();
    const secondName = String(form.get("secondName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    form.set(
      "name",
      [firstName, secondName, lastName].filter(Boolean).join(" "),
    );
    form.set("role", asProvider ? "PROVIDER" : "TOURIST");
    if (asProvider) {
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
    } else {
      for (const key of [
        "businessName",
        "registrationNumber",
        "companyEmail",
        "kraPin",
        "postalAddress",
        "countyId",
        "townId",
        "businessType",
        "operatingDays",
        "opensAt",
        "closesAt",
        "establishedDate",
        "latitude",
        "longitude",
        "ownerIdDoc",
        "kraPinDoc",
        "registrationCert",
        "businessPermit",
        "kycDoc",
        "selfieDoc",
        "otherDocs",
        "website",
        "directors",
        "registrantRole",
        "mpesaTillOrPaybill",
        "businessPermitExpiresAt",
        "traLicenceExpiresAt",
        "termsAccepted",
        "privacyAccepted",
        "phoneOtpId",
        "emailOtpId",
        "amenities",
      ]) {
        form.delete(key);
      }
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: asProvider ? form : JSON.stringify(Object.fromEntries(form)),
      headers: asProvider
        ? undefined
        : { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      const msg = data.error || "Registration failed";
      setError(msg);
      // Jump back to docs if uploads are the problem
      if (/upload|document|selfie|permit|KRA PIN document|CR12|incorporation/i.test(msg)) {
        setStep(4);
      } else if (/OTP|verif/i.test(msg)) {
        setStep(6);
      }
      return;
    }

    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (asProvider) {
      try {
        localStorage.removeItem(DRAFT_KEY);
        await fetch(
          `/api/auth/register-draft?email=${encodeURIComponent(email)}`,
          { method: "DELETE" },
        );
      } catch {
        /* non-blocking */
      }
    }

    const tabBind = createTabBind();
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    writeTabBind(tabBind);
    setLoading(false);
    if (asProvider) {
      router.push("/provider");
    } else if (callbackUrl.startsWith("/")) {
      router.push(callbackUrl);
    } else {
      router.push("/account");
    }
    router.refresh();
  }

  function getReviewSummary() {
    const form = formRef.current;
    if (!form) return null;
    const fd = new FormData(form);
    const roleLabel =
      REGISTRANT_ROLES.find((r) => r.value === registrantRole)?.label ||
      registrantRole;
    const firstName = String(fd.get("firstName") || "").trim();
    const secondName = String(fd.get("secondName") || "").trim();
    const lastName = String(fd.get("lastName") || "").trim();
    return {
      name: [firstName, secondName, lastName].filter(Boolean).join(" "),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      roleLabel,
      businessName: String(fd.get("businessName") || "").trim(),
      kycType,
      registrationNumber: String(fd.get("registrationNumber") || "").trim(),
      postalAddress: String(fd.get("postalAddress") || "").trim(),
      companyEmail: String(fd.get("companyEmail") || "").trim(),
      kraPin: String(fd.get("kraPin") || "").trim(),
      businessType: String(fd.get("businessType") || "").trim(),
      amenities: amenities.map((a) => amenityLabel(a)),
    };
  }

  const reviewSummary = step === 6 ? getReviewSummary() : null;
  const amenityCategories = categoriesForBusinessType(businessType);

  if (platformReady && !allowSelfSignup) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Sign-up is closed
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          Public registration is currently disabled. If you already have an
          account,{" "}
          <Link href="/login" className="font-semibold underline">
            log in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-auto flex min-h-[calc(100vh-4rem)] flex-col justify-center px-4 py-12 ${
        asProvider ? "max-w-xl" : "max-w-md"
      }`}
    >
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md px-4 py-2 text-sm shadow-lg ${
              t.tone === "success" ? "bg-lake text-sand" : "bg-red-600 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-40 max-w-lg rounded-full bg-cover bg-center opacity-30 blur-sm"
        style={{ backgroundImage: "url('/hero/kenya-safari.jpg')" }}
      />
      <div className="card relative animate-fade-up p-8 shadow-md">
        <h1 className="font-display text-3xl font-semibold text-lake">
          Join {platformName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {asProvider
            ? "Register your hospitality business in a few short steps. An admin will verify before you can list."
            : "Travellers book stays and experiences. Operators get a hospitality OS."}
        </p>

        {asProvider && (
          <div className="mt-6">
            <Stepper step={step} steps={steps} />
          </div>
        )}

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
              if (t.name === "countyId" || t.name === "townId") {
                clearFieldError("location");
              }
            }
          }}
          className="mt-6 space-y-4"
          encType="multipart/form-data"
          noValidate={asProvider}
        >
          {/* Step 0 — Account */}
          <div className={step === 0 ? "space-y-4" : "hidden"}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-medium text-ink">
                First name *
                <input
                  name="firstName"
                  required
                  autoComplete="given-name"
                  className={inputClass(Boolean(fieldErrors.firstName))}
                />
                <FieldError message={fieldErrors.firstName} />
              </label>
              <label className="block text-sm font-medium text-ink">
                Second name{" "}
                <span className="font-normal text-ink-muted">(optional)</span>
                <input
                  name="secondName"
                  autoComplete="additional-name"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Last name *
                <input
                  name="lastName"
                  required
                  autoComplete="family-name"
                  className={inputClass(Boolean(fieldErrors.lastName))}
                />
                <FieldError message={fieldErrors.lastName} />
              </label>
            </div>
            <label className="block text-sm font-medium text-ink">
              National ID number {asProvider ? "*" : "(optional)"}
              <input
                name="idNumber"
                required={asProvider && step === 0}
                inputMode="numeric"
                placeholder="e.g. 12345678"
                autoComplete="off"
                className={inputClass(Boolean(fieldErrors.idNumber))}
              />
              <FieldError message={fieldErrors.idNumber} />
              {!fieldErrors.idNumber && (
                <span className="mt-1 block text-xs font-normal text-ink-muted">
                  As on your national ID card
                </span>
              )}
            </label>
            <label className="block text-sm font-medium text-ink">
              Email *
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass(Boolean(fieldErrors.email))}
              />
              <FieldError message={fieldErrors.email} />
            </label>
            <label className="block text-sm font-medium text-ink">
              Phone *
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                minLength={10}
                placeholder="0712 345 678"
                pattern="[\d\s+\-]{10,}"
                title="Kenyan phone with at least 10 digits"
                className={inputClass(Boolean(fieldErrors.phone))}
              />
              <FieldError message={fieldErrors.phone} />
              {!fieldErrors.phone && (
                <span className="mt-1 block text-xs font-normal text-ink-muted">
                  At least 10 digits · e.g. 0712345678 or +254712345678
                </span>
              )}
            </label>
            <label className="block text-sm font-medium text-ink">
              Password
              <input
                name="password"
                type="password"
                required={!asProvider || step === 0}
                minLength={minPasswordLength}
                autoComplete="new-password"
                className={inputClass(Boolean(fieldErrors.password))}
              />
              <FieldError message={fieldErrors.password} />
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                asProvider
                  ? "border-lake bg-lake/5"
                  : "border-line hover:border-lake-bright"
              }`}
            >
              <input
                type="checkbox"
                checked={asProvider}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAsProvider(on);
                  setStep(0);
                  setError(null);
                }}
                className="size-4 accent-lake"
              />
              <span>
                <span className="font-medium text-ink">
                  I want to register as a provider
                </span>
                <span className="block text-xs text-ink-muted">
                  Hotel, lodge, restaurant, tour or venue — stepped verification.
                </span>
              </span>
            </label>
          </div>

          {/* Step 1 — Role & business identity */}
          {asProvider && (
            <div className={step === 1 ? "space-y-8" : "hidden"}>
              <div>
                <h2 className="font-display text-xl font-semibold text-lake">
                  Tell us about the business
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Three quick answers — business name, how it&apos;s registered,
                  and your role there.
                </p>
              </div>

              {/* 1. Business name */}
              <section className="space-y-2">
                <p className="text-sm font-semibold text-ink">
                  1. What is the business called?
                </p>
                <label className="block text-sm text-ink-muted">
                  Business / venue name *
                  <input
                    name="businessName"
                    required={step === 1}
                    placeholder="e.g. Lake Naivasha Lodge"
                    className={inputClass(Boolean(fieldErrors.businessName))}
                  />
                  <FieldError message={fieldErrors.businessName} />
                </label>
              </section>

              {/* 2. KYC type */}
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
                        body: "Uses your national ID from the Account step",
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
                {kycType === "COMPANY" && (
                  <label className="mt-2 block text-sm font-medium text-ink">
                    Company registration number *
                    <input
                      name="registrationNumber"
                      required={step === 1}
                      placeholder="e.g. PVT-XXXXXXX"
                      className={inputClass(
                        Boolean(fieldErrors.registrationNumber),
                      )}
                    />
                    <FieldError message={fieldErrors.registrationNumber} />
                  </label>
                )}
              </section>

              {/* 3. Your role — dropdown */}
              <section className="space-y-2">
                <p className="text-sm font-semibold text-ink">
                  3. Who are you at this company?
                </p>
                <label className="block text-sm text-ink-muted">
                  Your role *
                  <select
                    name="registrantRole"
                    required={step === 1}
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
          )}

          {/* Step 2 — Location */}
          {asProvider && (
            <div className={step === 2 ? "block" : "hidden"}>
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
          )}

          {/* Step 3 — Business details */}
          {asProvider && (
            <div
              className={step === 3 ? "block" : "hidden"}
              onChange={(e) => {
                const t = e.target;
                if (
                  t instanceof HTMLSelectElement &&
                  t.name === "businessType"
                ) {
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
                  establishedDate: fieldErrors.establishedDate,
                  opensAt: fieldErrors.opensAt,
                  closesAt: fieldErrors.closesAt,
                }}
              />
            </div>
          )}

          {/* Step 4 — Documents */}
          {asProvider && (
            <div className={step === 4 ? "block" : "hidden"}>
              <ProviderDocumentsSection kycType={kycType} />
            </div>
          )}

          {/* Step 5 — Amenities */}
          {asProvider && (
            <div className={step === 5 ? "space-y-4" : "hidden"}>
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Amenities at your business
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Tick what guests get on site. You can refine these later on
                  each listing.
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
                <p className="text-xs text-ink-muted">
                  {amenities.length} selected
                </p>
              )}
            </div>
          )}

          {/* Step 6 — Review + OTP at bottom */}
          {asProvider && (
            <div className={step === 6 ? "space-y-4" : "hidden"}>
              <div>
                <h2 className="font-display text-xl font-semibold text-lake">
                  Review before submitting
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Check your details, accept terms, then verify with a one-time
                  code at the bottom.
                </p>
              </div>

              {reviewSummary && (
                <dl className="space-y-2 rounded-lg border border-line bg-white/60 p-4 text-sm">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Contact
                      </dt>
                      <dd className="text-ink">{reviewSummary.name}</dd>
                      <dd className="text-ink-muted">{reviewSummary.email}</dd>
                      <dd className="text-ink-muted">{reviewSummary.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Role & business
                      </dt>
                      <dd className="text-ink">{reviewSummary.roleLabel}</dd>
                      <dd className="text-ink">{reviewSummary.businessName}</dd>
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
                        Business
                      </dt>
                      <dd className="text-ink-muted">{reviewSummary.companyEmail}</dd>
                      <dd className="text-ink-muted">
                        KRA {reviewSummary.kraPin || "—"} ·{" "}
                        {reviewSummary.businessType || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Docs & amenities
                      </dt>
                      <dd className="text-xs text-ink-muted">
                        Documents uploaded · listings (rooms / events) come later
                      </dd>
                      <dd className="mt-1 text-ink-muted">
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
                    className="font-medium text-lake-bright underline underline-offset-2 hover:text-lake"
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
                    className="font-medium text-lake-bright underline underline-offset-2 hover:text-lake"
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
                    Choose SMS or email, send the code, then verify before you
                    submit.
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
                      <p className="text-sm font-medium text-ink">
                        SMS verification
                      </p>
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
                        Local test code (never expires):{" "}
                        <span className="font-mono font-semibold">
                          {phoneDevCode}
                        </span>
                      </p>
                    )}
                    {phoneOtpId && !phoneVerified && (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
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
                        Local test code (never expires):{" "}
                        <span className="font-mono font-semibold">
                          {emailDevCode}
                        </span>
                      </p>
                    )}
                    {emailOtpId && !emailVerified && (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
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
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {asProvider && step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading || savingDraft}
                className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-lake-bright disabled:opacity-60"
              >
                Back
              </button>
            )}
            {asProvider && (
              <button
                type="button"
                onClick={() => void saveAndFinishLater()}
                disabled={loading || savingDraft}
                className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-lake-bright disabled:opacity-60"
              >
                {savingDraft ? "Saving…" : "Save & finish later"}
              </button>
            )}
            {asProvider && step < maxStep ? (
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
                disabled={loading || savingDraft}
                className="flex-1 rounded-lg bg-lake py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md disabled:opacity-60"
              >
                {loading
                  ? "Creating…"
                  : asProvider
                    ? "Submit for verification"
                    : "Create account"}
              </button>
            )}
          </div>

          {asProvider && step === maxStep && (
            <p className="text-center text-xs text-ink-muted">
              An admin will review your role, map pin, and documents before you
              can publish listings.
            </p>
          )}
        </form>
        <p className="mt-6 text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-lake-bright underline underline-offset-2 hover:text-lake"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-ink-muted">Loading…</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
