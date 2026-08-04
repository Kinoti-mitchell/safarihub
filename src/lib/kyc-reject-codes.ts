/** Structured KYC decline reasons shown to providers. */
export const KYC_REJECT_CODES = [
  {
    code: "BLURRY_ID",
    label: "National ID / passport unclear or unreadable",
  },
  {
    code: "ID_MISMATCH",
    label: "ID name does not match business / registrant",
  },
  {
    code: "EXPIRED_PERMIT",
    label: "Business permit expired or missing expiry",
  },
  {
    code: "MISSING_CR12",
    label: "CR12 / company registration document missing",
  },
  {
    code: "KRA_MISMATCH",
    label: "KRA PIN missing, unclear, or does not match",
  },
  {
    code: "SELFIE_MISMATCH",
    label: "Selfie / liveness does not match ID",
  },
  {
    code: "MPESA_INVALID",
    label: "M-Pesa till / paybill / payout phone invalid",
  },
  {
    code: "ADDRESS_UNCLEAR",
    label: "Business address or map pin incomplete",
  },
  {
    code: "DUPLICATE_BUSINESS",
    label: "Looks like a duplicate of an existing business",
  },
  {
    code: "OTHER",
    label: "Other — see free-text note",
  },
] as const;

export type KycRejectCode = (typeof KYC_REJECT_CODES)[number]["code"];

export function formatRejectionSummary(
  codes: string[] | null | undefined,
  note?: string | null,
): string {
  const labels = (codes ?? [])
    .map((c) => KYC_REJECT_CODES.find((x) => x.code === c)?.label || c)
    .filter(Boolean);
  const parts = [...labels];
  if (note?.trim()) parts.push(note.trim());
  return parts.join("; ") || "Documents incomplete";
}
