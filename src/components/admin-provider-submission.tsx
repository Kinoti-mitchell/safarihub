"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { amenityLabel } from "@/lib/amenities";
import {
  businessTypeLabel,
  registrantRoleLabel,
} from "@/lib/provider-verification";

export type AdminSubmissionBusiness = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isApproved?: boolean;
  kycType?: string | null;
  idNumber?: string | null;
  registrationNumber?: string | null;
  kycStatus?: string | null;
  kraPin?: string | null;
  companyEmail?: string | null;
  postalAddress?: string | null;
  businessType?: string | null;
  amenities?: string[] | null;
  operatingDays?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  establishedDate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  directors?: Array<{
    name: string;
    idNumber?: string | null;
    role?: string | null;
  }> | null;
  otherDocsUrls?: string[] | null;
  registrantRole?: string | null;
  ownerIdDocUrl?: string | null;
  kraPinDocUrl?: string | null;
  registrationCertUrl?: string | null;
  businessPermitUrl?: string | null;
  kycDocUrl?: string | null;
  selfieDocUrl?: string | null;
  mpesaTillOrPaybill?: string | null;
  businessPermitExpiresAt?: string | null;
  traLicenceExpiresAt?: string | null;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  phoneVerifiedAt?: string | null;
  emailVerifiedAt?: string | null;
  rejectionReason?: string | null;
  countyName?: string | null;
  townName?: string | null;
  createdAt?: string | null;
};

type OwnerInfo = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function adminDocHref(url: string) {
  return `/api/admin/documents/view?url=${encodeURIComponent(url)}`;
}

function isImageDoc(url: string) {
  return /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(url);
}

function isPdfDoc(url: string) {
  return /\.pdf(\?|#|$)/i.test(url);
}

function DocCard({ label, url }: { label: string; url?: string | null }) {
  if (!url) {
    return (
      <li className="flex flex-col rounded-lg border border-dashed border-red-200 bg-red-50/60 p-3">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-1 text-xs text-red-700">Not uploaded</p>
      </li>
    );
  }

  const viewHref = adminDocHref(url);
  const image = isImageDoc(url);
  const pdf = isPdfDoc(url);

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="relative flex h-40 items-center justify-center bg-sand/40">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={viewHref}
            alt={label}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="px-3 text-center">
            <p className="text-2xl font-semibold text-ink-muted">
              {pdf ? "PDF" : "FILE"}
            </p>
            <p className="mt-1 text-xs text-ink-muted">Preview in new tab</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <a
          href={viewHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-lake px-2.5 py-1 text-xs font-semibold text-sand"
        >
          View
        </a>
      </div>
    </li>
  );
}

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
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Full registration dossier for admin review (pending approvals + provider detail).
 */
export function AdminProviderSubmission({
  business,
  owner,
  detailHref,
  actions,
}: {
  business: AdminSubmissionBusiness;
  owner?: OwnerInfo | null;
  detailHref?: string;
  /** Commission / approve / decline controls — shown after the dossier. */
  actions?: ReactNode;
}) {
  const isCompany =
    (business.kycType || "").toUpperCase() === "COMPANY" ||
    Boolean(business.registrationNumber);
  const amenities = Array.isArray(business.amenities) ? business.amenities : [];
  const directors = Array.isArray(business.directors) ? business.directors : [];
  const otherDocs = Array.isArray(business.otherDocsUrls)
    ? business.otherDocsUrls.filter(Boolean)
    : [];
  const hours =
    business.opensAt || business.closesAt
      ? `${business.opensAt || "—"} – ${business.closesAt || "—"}`
      : null;
  const place = [business.townName, business.countyName]
    .filter(Boolean)
    .join(", ");

  const docs: Array<{ label: string; url?: string | null }> = [
    { label: "Owner national ID", url: business.ownerIdDocUrl },
    { label: "Selfie holding ID", url: business.selfieDocUrl },
    { label: "KRA PIN document", url: business.kraPinDocUrl },
    {
      label: "Certificate of incorporation",
      url: business.registrationCertUrl,
    },
    {
      label: "Business permit / tourism licence",
      url: business.businessPermitUrl,
    },
    { label: "CR12 / supporting KYC", url: business.kycDocUrl },
    ...otherDocs.map((url, i) => ({
      label: `Other document ${i + 1}`,
      url,
    })),
  ].filter((d) => {
    // Always show core identity docs; hide empty company-only slots for sole traders.
    if (
      !isCompany &&
      (d.label === "Certificate of incorporation" ||
        d.label === "CR12 / supporting KYC") &&
      !d.url
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Full submission
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Everything the registrant submitted for this business.
          </p>
        </div>
        {detailHref && (
          <Link
            href={detailHref}
            className="rounded-md border border-lake px-3 py-1.5 text-xs font-semibold text-lake"
          >
            Open full page →
          </Link>
        )}
      </div>

      {business.rejectionReason && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Previous rejection: {business.rejectionReason}
        </p>
      )}

      <section className="rounded-lg border border-lake/25 bg-white p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Uploaded documents
          </h4>
          <p className="text-xs text-ink-muted">
            {docs.filter((d) => d.url).length} of {docs.length} on file — open
            to review before approving
          </p>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <DocCard key={d.label} label={d.label} url={d.url} />
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Owner account
        </h4>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={owner?.name || "—"} />
          <Field
            label="Role at business"
            value={registrantRoleLabel(business.registrantRole)}
          />
          <Field label="Login email" value={owner?.email || "—"} />
          <Field
            label="Phone"
            value={owner?.phone || business.phone || "—"}
          />
          <Field
            label="National ID"
            value={business.idNumber || "—"}
          />
          <Field
            label="Submitted"
            value={fmtDateTime(business.createdAt)}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Business identity
        </h4>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Business name" value={business.name} />
          <Field
            label="Registration type"
            value={isCompany ? "Limited company" : "Individual / sole trader"}
          />
          <Field
            label="Business type"
            value={businessTypeLabel(business.businessType)}
          />
          {isCompany ? (
            <Field
              label="Company registration no."
              value={business.registrationNumber}
            />
          ) : (
            <Field label="National ID on file" value={business.idNumber} />
          )}
          <Field
            label="Company email"
            value={business.companyEmail || business.email}
          />
          <Field label="Business phone" value={business.phone} />
          <Field
            label="Website"
            value={
              business.website ? (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lake-bright underline"
                >
                  {business.website}
                </a>
              ) : (
                "—"
              )
            }
          />
          <Field label="KYC status" value={business.kycStatus || "PENDING"} />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Location & hours
        </h4>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Address" value={business.postalAddress} full />
          <Field label="County / town" value={place || "—"} />
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
            label="Started operating"
            value={fmtDate(business.establishedDate)}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Tax & payouts
        </h4>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="KRA PIN" value={business.kraPin} />
          <Field
            label="Permit / TRA expiry"
            value={fmtDate(business.businessPermitExpiresAt)}
          />
          <Field
            label="TRA licence expiry"
            value={fmtDate(business.traLicenceExpiresAt)}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Amenities
        </h4>
        <p className="mt-2 text-sm text-ink">
          {amenities.length
            ? amenities.map((a) => amenityLabel(String(a))).join(" · ")
            : "—"}
        </p>
      </section>

      {directors.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Directors
          </h4>
          <ul className="mt-2 space-y-1 text-sm">
            {directors.map((d, i) => (
              <li key={`${d.name}-${i}`}>
                {d.name}
                {d.role ? ` · ${d.role}` : ""}
                {d.idNumber ? ` · ID ${d.idNumber}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-line bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Agreements & OTP
        </h4>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Terms accepted"
            value={fmtDateTime(business.termsAcceptedAt)}
          />
          <Field
            label="Privacy accepted"
            value={fmtDateTime(business.privacyAcceptedAt)}
          />
          <Field
            label="Phone OTP verified"
            value={fmtDateTime(business.phoneVerifiedAt)}
          />
          <Field
            label="Email OTP verified"
            value={fmtDateTime(business.emailVerifiedAt)}
          />
        </dl>
      </section>

      {actions && (
        <section className="rounded-lg border border-lake/30 bg-lake/5 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Decision
          </h4>
          <p className="mt-1 text-xs text-ink-muted">
            Set commission, then approve or decline this submission.
          </p>
          <div className="mt-3">{actions}</div>
        </section>
      )}
    </div>
  );
}
