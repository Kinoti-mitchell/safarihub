"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" };

type PendingListing = {
  id: string;
  title: string;
  category: string;
  status: string;
  description: string | null;
  address: string | null;
  createdAt: string;
  featured: boolean;
  isPromoted: boolean;
  county: { name: string } | null;
  town: { name: string } | null;
  photoCount: number;
  coverUrl: string | null;
  offerCount: number;
  fromPrice: number | null;
};

type PendingBusiness = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isApproved: boolean;
  commissionRate: number;
  createdAt: string;
  kycType: string | null;
  idNumber: string | null;
  registrationNumber: string | null;
  kycDocUrl: string | null;
  kycStatus: string | null;
  kraPin: string | null;
  companyEmail: string | null;
  postalAddress: string | null;
  businessType: string | null;
  operatingDays: string | null;
  opensAt: string | null;
  closesAt: string | null;
  establishedDate: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  directors: Array<{
    name: string;
    idNumber?: string | null;
    role?: string | null;
  }>;
  otherDocsUrls: string[];
  registrantRole: string | null;
  ownerIdDocUrl: string | null;
  kraPinDocUrl: string | null;
  registrationCertUrl: string | null;
  businessPermitUrl: string | null;
  countyName: string | null;
  townName: string | null;
  pendingListings: PendingListing[];
  listingCount: number;
};

type PendingOwner = {
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  createdAt: string;
  businessCount: number;
  pendingBusinessCount: number;
  pendingListingCount: number;
  businesses: PendingBusiness[];
};

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AdminApprovalsPage() {
  const [owners, setOwners] = useState<PendingOwner[]>([]);
  const [summary, setSummary] = useState({
    owners: 0,
    businesses: 0,
    listings: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [openOwnerId, setOpenOwnerId] = useState<string | null>(null);
  const [openBusinessId, setOpenBusinessId] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const setActionBusy = useCallback((key: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/approvals/pending");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load review queue");
        return;
      }
      setError(null);
      setOwners(body.pendingOwners || []);
      setSummary(
        body.summary || { owners: 0, businesses: 0, listings: 0 },
      );
      const nextRates: Record<string, number> = {};
      for (const o of body.pendingOwners || []) {
        for (const b of o.businesses || []) {
          nextRates[b.id] = b.commissionRate ?? 10;
        }
      }
      setRates((prev) => ({ ...nextRates, ...prev }));
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approveBusiness(b: PendingBusiness) {
    const key = `provider:${b.id}`;
    setActionBusy(key, true);
    try {
      const res = await fetch(`/api/admin/providers/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isApproved: true,
          commissionRate: rates[b.id] ?? b.commissionRate ?? 10,
          kycStatus: "VERIFIED",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not approve", "error");
        return;
      }
      pushToast(`${b.name} approved — confirmation sent`, "success");
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setActionBusy(key, false);
    }
  }

  const pendingTotal = summary.businesses + summary.listings;

  return (
    <div className="px-4 py-10 sm:px-8">
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

      <div>
        <h1 className="font-display text-3xl font-semibold text-lake">
          Pending approvals
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {loaded
            ? pendingTotal > 0
              ? `${summary.owners} owner${summary.owners === 1 ? "" : "s"} · ${summary.businesses} business${summary.businesses === 1 ? "" : "es"} · ${summary.listings} listing${summary.listings === 1 ? "" : "s"} waiting`
              : "Queue is clear — nothing pending"
            : "Loading…"}
        </p>
      </div>

      {error && (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-md bg-lake px-3 py-1.5 text-sm text-sand"
          >
            Retry
          </button>
        </div>
      )}

      {!loaded && !error && (
        <p className="mt-6 text-sm text-ink-muted">Loading review queue…</p>
      )}

      {loaded && !error && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            Owners in queue
            <span className="ml-2 rounded-full bg-lake/10 px-2 py-0.5 text-xs text-lake">
              {owners.length}
            </span>
          </h2>

          {owners.length === 0 ? (
            <div className="mt-3 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
              No owners awaiting review.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {owners.map((o) => {
                const isOpen = openOwnerId === o.ownerId;
                return (
                  <li
                    key={o.ownerId}
                    className="overflow-hidden rounded-lg border border-line bg-white/70"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenOwnerId((cur) =>
                          cur === o.ownerId ? null : o.ownerId,
                        );
                        setOpenBusinessId(null);
                      }}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-sand/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{o.ownerName}</p>
                        <p className="text-sm text-ink-muted">
                          {o.ownerEmail || "No email"}
                          {o.ownerPhone ? ` · ${o.ownerPhone}` : ""} ·{" "}
                          {o.pendingBusinessCount} business
                          {o.pendingBusinessCount === 1 ? "" : "es"} to approve
                          {o.pendingListingCount > 0
                            ? ` · ${o.pendingListingCount} listing${o.pendingListingCount === 1 ? "" : "s"} pending`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-sun/20 px-2 py-0.5 text-xs font-medium text-ink">
                          joined {daysAgo(o.createdAt)}
                        </span>
                        <span className="text-sm text-ink-muted" aria-hidden>
                          {isOpen ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-line bg-sand/20 px-3 py-3 sm:px-4">
                        {o.businesses.map((b) => {
                          const bizOpen = openBusinessId === b.id;
                          const isBusy = busy.has(`provider:${b.id}`);
                          const rate = rates[b.id] ?? b.commissionRate ?? 10;
                          const isCompany =
                            b.kycType === "COMPANY" ||
                            Boolean(b.registrationNumber);
                          const identity = isCompany
                            ? `Reg ${b.registrationNumber || "—"}`
                            : `ID ${b.idNumber || "—"}`;

                          return (
                            <div
                              key={b.id}
                              className="overflow-hidden rounded-lg border border-line bg-white/80"
                            >
                              <div className="px-3 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenBusinessId((cur) =>
                                        cur === b.id ? null : b.id,
                                      )
                                    }
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium text-ink">
                                        {b.name}
                                      </p>
                                      {!b.isApproved ? (
                                        <span className="rounded-full bg-sun/25 px-2 py-0.5 text-[0.65rem] font-medium text-ink">
                                          business pending
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-lake/10 px-2 py-0.5 text-[0.65rem] font-medium text-lake">
                                          business approved
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-ink-muted">
                                      {(b.kycType || "INDIVIDUAL").toLowerCase()}{" "}
                                      · {identity}
                                      {b.ownerIdDocUrl ||
                                      b.registrationCertUrl ||
                                      b.kycDocUrl
                                        ? " · docs on file"
                                        : " · no documents"}{" "}
                                      · {b.pendingListings.length} listing
                                      {b.pendingListings.length === 1
                                        ? ""
                                        : "s"}{" "}
                                      pending · signed up {daysAgo(b.createdAt)}
                                    </p>
                                  </button>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {!b.isApproved && (
                                      <>
                                        <label className="flex items-center gap-1 text-xs text-ink-muted">
                                          Commission
                                          <input
                                            type="number"
                                            min={0}
                                            max={50}
                                            value={rate}
                                            onChange={(e) =>
                                              setRates((r) => ({
                                                ...r,
                                                [b.id]: Number(e.target.value),
                                              }))
                                            }
                                            className="w-14 rounded border border-line px-2 py-1 text-sm"
                                          />
                                          %
                                        </label>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() =>
                                            void approveBusiness(b)
                                          }
                                          className="rounded-md bg-lake px-3 py-1.5 text-sm text-sand disabled:opacity-50"
                                        >
                                          {isBusy ? "Approving…" : "Approve"}
                                        </button>
                                      </>
                                    )}
                                    <Link
                                      href={`/admin/providers/${b.id}`}
                                      className="rounded-md border border-line px-3 py-1.5 text-sm"
                                    >
                                      Review
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenBusinessId((cur) =>
                                          cur === b.id ? null : b.id,
                                        )
                                      }
                                      className="text-sm text-ink-muted"
                                      aria-label={
                                        bizOpen
                                          ? "Hide listings"
                                          : "Show listings"
                                      }
                                    >
                                      {bizOpen ? "▾" : "▸"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {bizOpen && (
                                <div className="border-t border-line bg-sand/10 px-3 py-3">
                                  {!b.isApproved && (
                                    <div className="mb-4 space-y-2 rounded-md border border-line bg-white p-3 text-sm">
                                      <p className="font-semibold text-ink">
                                        Verification checklist
                                      </p>
                                      <ul className="grid gap-1 text-xs text-ink-muted sm:grid-cols-2">
                                        <li className="sm:col-span-2 font-medium text-ink">
                                          Registered by:{" "}
                                          {b.registrantRole
                                            ? b.registrantRole
                                                .replace(/_/g, " ")
                                                .replace(/\b\w/g, (c) =>
                                                  c.toUpperCase(),
                                                )
                                            : "—"}
                                        </li>
                                        <li>
                                          Type:{" "}
                                          {(b.businessType || "—").replace(
                                            /_/g,
                                            " ",
                                          )}
                                        </li>
                                        <li>KRA: {b.kraPin || "—"}</li>
                                        <li>
                                          Company email:{" "}
                                          {b.companyEmail || b.email || "—"}
                                        </li>
                                        <li>
                                          Place:{" "}
                                          {[b.townName, b.countyName]
                                            .filter(Boolean)
                                            .join(", ") || "—"}
                                        </li>
                                        <li className="sm:col-span-2">
                                          Address: {b.postalAddress || "—"}
                                        </li>
                                        <li>
                                          Hours: {b.operatingDays || "—"}{" "}
                                          {b.opensAt && b.closesAt
                                            ? `${b.opensAt}–${b.closesAt}`
                                            : ""}
                                        </li>
                                        <li>
                                          Established:{" "}
                                          {b.establishedDate || "—"}
                                        </li>
                                        <li>
                                          GPS:{" "}
                                          {b.latitude != null &&
                                          b.longitude != null
                                            ? `${b.latitude.toFixed(4)}, ${b.longitude.toFixed(4)}`
                                            : "—"}
                                        </li>
                                        <li>
                                          Website:{" "}
                                          {b.website ? (
                                            <a
                                              href={b.website}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-lake-bright underline"
                                            >
                                              {b.website.replace(/^https?:\/\//, "")}
                                            </a>
                                          ) : (
                                            "—"
                                          )}
                                        </li>
                                        <li className="sm:col-span-2">
                                          Directors:{" "}
                                          {b.directors?.length
                                            ? b.directors
                                                .map(
                                                  (d) =>
                                                    `${d.name}${d.role ? ` (${d.role})` : ""}`,
                                                )
                                                .join("; ")
                                            : "—"}
                                        </li>
                                      </ul>
                                      <div className="flex flex-wrap gap-2 pt-1">
                                        {b.ownerIdDocUrl && (
                                          <a
                                            href={b.ownerIdDocUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-lake-bright underline"
                                          >
                                            Owner ID
                                          </a>
                                        )}
                                        {b.kraPinDocUrl && (
                                          <a
                                            href={b.kraPinDocUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-lake-bright underline"
                                          >
                                            KRA PIN
                                          </a>
                                        )}
                                        {b.registrationCertUrl && (
                                          <a
                                            href={b.registrationCertUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-lake-bright underline"
                                          >
                                            Certificate of incorporation
                                          </a>
                                        )}
                                        {b.businessPermitUrl && (
                                          <a
                                            href={b.businessPermitUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-lake-bright underline"
                                          >
                                            Business permit
                                          </a>
                                        )}
                                        {b.kycDocUrl && (
                                          <a
                                            href={b.kycDocUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-lake-bright underline"
                                          >
                                            CR12 / supporting
                                          </a>
                                        )}
                                        {(b.otherDocsUrls || []).map((url, i) => (
                                          <a
                                            key={`${url}-${i}`}
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-lake-bright underline"
                                          >
                                            Other doc {i + 1}
                                          </a>
                                        ))}
                                        {!b.ownerIdDocUrl &&
                                          !b.kraPinDocUrl &&
                                          !b.registrationCertUrl &&
                                          !b.kycDocUrl &&
                                          !(b.otherDocsUrls || []).length && (
                                            <span className="text-xs text-red-700">
                                              No documents uploaded
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  )}
                                  {b.pendingListings.length === 0 ? (
                                    <p className="py-2 text-center text-sm text-ink-muted">
                                      {b.isApproved
                                        ? "No listings pending review."
                                        : "No listings submitted for review yet — approve the business so they can publish."}
                                    </p>
                                  ) : (
                                    <ul className="space-y-3">
                                      {b.pendingListings.map((l) => {
                                        const incomplete =
                                          l.photoCount === 0 || !l.fromPrice;
                                        const place = [
                                          l.town?.name,
                                          l.county?.name,
                                        ]
                                          .filter(Boolean)
                                          .join(", ");
                                        return (
                                          <li key={l.id}>
                                            <Link
                                              href={`/admin/listings/${l.id}?from=pending`}
                                              className="group flex gap-3 rounded-lg border border-line bg-white p-3 transition hover:border-lake-bright hover:shadow-md"
                                            >
                                              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-sand">
                                                {l.coverUrl ? (
                                                  // eslint-disable-next-line @next/next/no-img-element
                                                  <img
                                                    src={l.coverUrl}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                  />
                                                ) : (
                                                  <div className="flex h-full items-center justify-center text-[0.65rem] text-ink-muted">
                                                    No photo
                                                  </div>
                                                )}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <p className="font-medium text-ink group-hover:text-lake">
                                                  {l.title}
                                                </p>
                                                <p className="mt-0.5 text-sm text-ink-muted">
                                                  {place || "No location"} ·{" "}
                                                  {l.category.toLowerCase()}
                                                  {l.offerCount
                                                    ? ` · ${l.offerCount} offer${l.offerCount === 1 ? "" : "s"}`
                                                    : ""}
                                                </p>
                                                {l.address && (
                                                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                                                    {l.address}
                                                  </p>
                                                )}
                                                {l.description && (
                                                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                                                    {l.description}
                                                  </p>
                                                )}
                                                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">
                                                  <span>
                                                    {l.photoCount} photo
                                                    {l.photoCount === 1
                                                      ? ""
                                                      : "s"}
                                                  </span>
                                                  <span>
                                                    {l.fromPrice
                                                      ? `from KES ${l.fromPrice.toLocaleString()}`
                                                      : "no price set"}
                                                  </span>
                                                  <span>
                                                    submitted{" "}
                                                    {daysAgo(l.createdAt)}
                                                  </span>
                                                </p>
                                                {incomplete && (
                                                  <p className="mt-1 text-xs text-amber-700">
                                                    Incomplete —
                                                    {l.photoCount === 0
                                                      ? " missing photos"
                                                      : ""}
                                                    {l.photoCount === 0 &&
                                                    !l.fromPrice
                                                      ? " and"
                                                      : ""}
                                                    {!l.fromPrice
                                                      ? " no price"
                                                      : ""}
                                                  </p>
                                                )}
                                              </div>
                                              <span className="shrink-0 self-center rounded-md bg-lake px-3 py-1.5 text-sm font-medium text-sand transition group-hover:bg-lake-bright">
                                                Review →
                                              </span>
                                            </Link>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
