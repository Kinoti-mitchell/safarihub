import {
  isValidKraPin,
  normalizeKraPin,
} from "@/lib/provider-verification";
import { findIdentityClash } from "@/lib/identity";
import { boolSetting, type SettingValue } from "@/lib/settings";

export type HardGate = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type HardGateResult = {
  passed: boolean;
  gates: HardGate[];
  failingLabels: string[];
};

/** Provider-shaped input for hard-gate checks (signup insert or DB row). */
export type ProviderGateInput = {
  id?: string | null;
  kycType?: string | null;
  phoneVerifiedAt?: string | null;
  emailVerifiedAt?: string | null;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  kraPin?: string | null;
  mpesaTillOrPaybill?: string | null;
  ownerIdDocUrl?: string | null;
  selfieDocUrl?: string | null;
  kraPinDocUrl?: string | null;
  businessPermitUrl?: string | null;
  registrationCertUrl?: string | null;
  kycDocUrl?: string | null;
  businessPermitExpiresAt?: string | null;
  amenities?: unknown;
  latitude?: number | null;
  longitude?: number | null;
  countyId?: string | null;
  townId?: string | null;
  idNumber?: string | null;
  registrationNumber?: string | null;
  phone?: string | null;
  email?: string | null;
};

function hasUrl(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim() && !String(v).includes("pending.local"));
}

function permitNotExpired(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

function amenityCount(amenities: unknown): number {
  return Array.isArray(amenities) ? amenities.length : 0;
}

/**
 * Hard gates for option A auto-approval.
 * All must pass before the system may set isApproved without a human.
 */
export function evaluateProviderHardGates(
  p: ProviderGateInput,
  opts?: { identityClashOk?: boolean; identityClashDetail?: string },
): HardGateResult {
  const kra = normalizeKraPin(p.kraPin);
  const kycType = (p.kycType || "INDIVIDUAL").toUpperCase();
  const isCompany = kycType === "COMPANY";

  const gates: HardGate[] = [
    {
      id: "contact_otp",
      label: "Contact verified (SMS or email OTP)",
      ok: Boolean(p.phoneVerifiedAt || p.emailVerifiedAt),
      detail:
        p.phoneVerifiedAt || p.emailVerifiedAt
          ? undefined
          : "Verify phone or email with a one-time code",
    },
    {
      id: "terms",
      label: "Terms accepted",
      ok: Boolean(p.termsAcceptedAt),
    },
    {
      id: "privacy",
      label: "Privacy policy accepted",
      ok: Boolean(p.privacyAcceptedAt),
    },
    {
      id: "kra_pin",
      label: "Valid KRA PIN",
      ok: Boolean(kra && isValidKraPin(kra)),
      detail: kra || undefined,
    },
    {
      id: "mpesa",
      label: "M-Pesa till / paybill",
      ok: Boolean(p.mpesaTillOrPaybill?.trim()),
    },
    {
      id: "owner_id",
      label: "Owner ID document",
      ok: hasUrl(p.ownerIdDocUrl),
    },
    {
      id: "selfie",
      label: "Selfie holding ID",
      ok: hasUrl(p.selfieDocUrl),
    },
    {
      id: "kra_doc",
      label: "KRA PIN document",
      ok: hasUrl(p.kraPinDocUrl),
    },
    {
      id: "permit",
      label: "Business permit / licence",
      ok: hasUrl(p.businessPermitUrl),
    },
    {
      id: "permit_expiry",
      label: "Permit not expired",
      ok: permitNotExpired(p.businessPermitExpiresAt),
      detail: p.businessPermitExpiresAt || "Missing expiry date",
    },
    {
      id: "incorporation",
      label: isCompany
        ? "Certificate of incorporation"
        : "Certificate of incorporation / registration",
      ok: hasUrl(p.registrationCertUrl),
    },
    {
      id: "cr12",
      label: isCompany ? "CR12 / supporting doc" : "Supporting KYC document",
      ok: hasUrl(p.kycDocUrl),
    },
    {
      id: "amenities",
      label: "At least one amenity",
      ok: amenityCount(p.amenities) >= 1,
      detail: `${amenityCount(p.amenities)} selected`,
    },
    {
      id: "location",
      label: "Map pin + county/town",
      ok:
        p.latitude != null &&
        p.longitude != null &&
        Boolean(p.countyId?.trim()) &&
        Boolean(p.townId?.trim()),
    },
    {
      id: "no_duplicate",
      label: "No duplicate identity / nearby GPS",
      ok: opts?.identityClashOk !== false,
      detail: opts?.identityClashDetail,
    },
  ];

  const failing = gates.filter((g) => !g.ok);
  return {
    passed: failing.length === 0,
    gates,
    failingLabels: failing.map((g) => g.label),
  };
}

/**
 * When auto-approve flag is on, approve only if every hard gate passes.
 * When flag is off, never auto-approve (admin must click).
 */
export async function resolveHardGateAutoApproval(
  p: ProviderGateInput,
  settings: Record<string, SettingValue>,
  opts?: {
    skipIdentityClash?: boolean;
    excludeUserId?: string | null;
    excludeProviderId?: string | null;
  },
): Promise<{
  isApproved: boolean;
  kycStatus: "PENDING" | "VERIFIED";
  autoApproved: boolean;
  enabled: boolean;
  gates: HardGateResult;
}> {
  const enabled = boolSetting(settings, "flags.autoApproveProviders");

  let identityClashOk = true;
  let identityClashDetail: string | undefined;
  if (!opts?.skipIdentityClash) {
    const clash = await findIdentityClash({
      email: p.email,
      phone: p.phone,
      idNumber: p.idNumber,
      registrationNumber: p.registrationNumber,
      kraPin: p.kraPin,
      latitude: p.latitude,
      longitude: p.longitude,
      excludeUserId: opts?.excludeUserId ?? null,
      excludeProviderId: opts?.excludeProviderId ?? p.id ?? null,
    });
    if (clash) {
      identityClashOk = false;
      identityClashDetail = clash.message;
    }
  }

  const gates = evaluateProviderHardGates(p, {
    identityClashOk,
    identityClashDetail,
  });

  if (enabled && gates.passed) {
    return {
      isApproved: true,
      kycStatus: "VERIFIED",
      autoApproved: true,
      enabled,
      gates,
    };
  }

  return {
    isApproved: false,
    kycStatus: "PENDING",
    autoApproved: false,
    enabled,
    gates,
  };
}
