"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminProviderSubmission } from "@/components/admin-provider-submission";

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
  publishFeeKes: number | null;
  publishPaymentRef: string | null;
  publishPaymentNote: string | null;
  publishPaymentStatus: string | null;
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
  amenities: string[];
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
  selfieDocUrl: string | null;
  mpesaTillOrPaybill: string | null;
  businessPermitExpiresAt: string | null;
  traLicenceExpiresAt: string | null;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  rejectionReason: string | null;
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
      setOpenBusinessId(null);
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setActionBusy(key, false);
    }
  }

  async function confirmPublishPayment(l: PendingListing) {
    setActionBusy(l.id, true);
    try {
      const res = await fetch(`/api/admin/listings/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not publish listing", "error");
        return;
      }
      pushToast(`${l.title} is live`, "success");
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setActionBusy(l.id, false);
    }
  }

  async function rejectBusiness(b: PendingBusiness) {
    const reason = window.prompt(
      "Decline reason (shown to the provider):",
      "Documents incomplete or unclear — please resubmit",
    );
    if (reason == null) return;
    const key = `provider:${b.id}`;
    setActionBusy(key, true);
    try {
      const res = await fetch(`/api/admin/providers/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isApproved: false,
          kycStatus: "REJECTED",
          rejectionReason: reason.trim() || "Documents incomplete",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not decline", "error");
        return;
      }
      pushToast(`${b.name} declined`, "success");
      setOpenBusinessId(null);
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
              ? `${summary.businesses} business${summary.businesses === 1 ? "" : "es"} to approve · ${summary.listings} listing${summary.listings === 1 ? "" : "s"} awaiting publish payment`
              : "Queue is clear — nothing pending"
            : "Loading…"}
        </p>
        <p className="mt-2 max-w-2xl text-xs text-ink-muted">
          Approve businesses (KYC). Listings go live after publish payment is
          verified — you no longer review listing content.
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
                                    <Link
                                      href={`/admin/providers/${b.id}?from=pending`}
                                      className="rounded-md border border-lake px-3 py-1.5 text-sm font-semibold text-lake"
                                    >
                                      Open submission
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenBusinessId((cur) =>
                                          cur === b.id ? null : b.id,
                                        )
                                      }
                                      className="text-sm font-medium text-ink-muted"
                                      aria-label={
                                        bizOpen
                                          ? "Hide details"
                                          : "Show details"
                                      }
                                    >
                                      {bizOpen ? "Hide ▾" : "Review here ▸"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {bizOpen && (
                                <div className="border-t border-line bg-sand/10 px-3 py-3">
                                  <div className="mb-4">
                                    <AdminProviderSubmission
                                      business={b}
                                      owner={{
                                        name: o.ownerName,
                                        email: o.ownerEmail,
                                        phone: o.ownerPhone,
                                      }}
                                      detailHref={`/admin/providers/${b.id}?from=pending`}
                                      actions={
                                        !b.isApproved ? (
                                          <div className="flex flex-wrap items-center gap-3">
                                            <label className="flex items-center gap-1.5 text-sm text-ink">
                                              Commission
                                              <input
                                                type="number"
                                                min={0}
                                                max={50}
                                                value={rate}
                                                onChange={(e) =>
                                                  setRates((r) => ({
                                                    ...r,
                                                    [b.id]: Number(
                                                      e.target.value,
                                                    ),
                                                  }))
                                                }
                                                className="w-16 rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                                              />
                                              %
                                            </label>
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() =>
                                                void approveBusiness(b)
                                              }
                                              className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-50"
                                            >
                                              {isBusy
                                                ? "Working…"
                                                : "Approve & notify"}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() =>
                                                void rejectBusiness(b)
                                              }
                                              className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                                            >
                                              Decline
                                            </button>
                                          </div>
                                        ) : undefined
                                      }
                                    />
                                  </div>
                                  <div className="border-t border-line pt-3">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                      Awaiting publish payment
                                    </p>
                                    {b.pendingListings.length === 0 ? (
                                      <p className="py-2 text-center text-sm text-ink-muted">
                                        {b.isApproved
                                          ? "No listings waiting on publish payment."
                                          : "Approve this business first — then they can pay to publish listings."}
                                      </p>
                                    ) : (
                                      <ul className="space-y-3">
                                        {b.pendingListings.map((l) => {
                                          const place = [
                                            l.town?.name,
                                            l.county?.name,
                                          ]
                                            .filter(Boolean)
                                            .join(", ");
                                          const fee =
                                            l.publishFeeKes != null
                                              ? `KES ${l.publishFeeKes.toLocaleString()}`
                                              : "fee";
                                          return (
                                            <li
                                              key={l.id}
                                              className="rounded-lg border border-line bg-white p-3"
                                            >
                                              <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                  <p className="font-medium text-ink">
                                                    {l.title}
                                                  </p>
                                                  <p className="mt-0.5 text-sm text-ink-muted">
                                                    {place || "No location"} ·{" "}
                                                    {l.category.toLowerCase()} ·{" "}
                                                    {fee}
                                                  </p>
                                                  {l.publishPaymentRef ? (
                                                    <p className="mt-2 rounded-md bg-sand/50 px-2 py-1.5 font-mono text-sm text-ink">
                                                      M-Pesa ref:{" "}
                                                      {l.publishPaymentRef}
                                                    </p>
                                                  ) : (
                                                    <p className="mt-2 text-xs text-amber-700">
                                                      No payment reference yet
                                                    </p>
                                                  )}
                                                  {l.publishPaymentNote && (
                                                    <p className="mt-1 text-xs text-ink-muted">
                                                      Note:{" "}
                                                      {l.publishPaymentNote}
                                                    </p>
                                                  )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                  <button
                                                    type="button"
                                                    disabled={busy.has(l.id)}
                                                    onClick={() =>
                                                      void confirmPublishPayment(
                                                        l,
                                                      )
                                                    }
                                                    className="rounded-md bg-lake px-3 py-1.5 text-sm font-semibold text-sand disabled:opacity-50"
                                                  >
                                                    {busy.has(l.id)
                                                      ? "Working…"
                                                      : "Confirm payment & go live"}
                                                  </button>
                                                  <Link
                                                    href={`/admin/listings/${l.id}?from=pending`}
                                                    className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted"
                                                  >
                                                    Open
                                                  </Link>
                                                </div>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </div>
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
