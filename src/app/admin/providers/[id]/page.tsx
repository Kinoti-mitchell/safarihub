"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminProviderSubmission } from "@/components/admin-provider-submission";

type Member = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  } | null;
};

type ListingRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  description?: string | null;
  address?: string | null;
  featured?: boolean;
  isPromoted?: boolean;
  boostEndsAt?: string | null;
  createdAt: string;
  countyName: string;
  townName?: string | null;
  photoCount: number;
  coverUrl?: string | null;
  offerCount?: number;
  amenityCount?: number;
  fromPrice: number | null;
  offers?: Array<{
    name: string;
    basePrice: number;
    quantity: number;
    offerKind: string | null;
  }>;
};

type BookingRow = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  listingTitle: string;
};

type HistoryEntry = {
  id: string;
  action: string;
  summary: string;
  actorName: string | null;
  createdAt: string;
};

type ProviderDetail = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  isApproved: boolean;
  commissionRate: number;
  kycType: string | null;
  idNumber: string | null;
  registrationNumber: string | null;
  kycDocUrl: string | null;
  kycStatus: string | null;
  payoutPhone?: string | null;
  kraPin?: string | null;
  etimsEnabled?: boolean;
  subscriptionPlan?: string | null;
  companyEmail?: string | null;
  postalAddress?: string | null;
  businessType?: string | null;
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
  selfieDocUrl?: string | null;
  mpesaTillOrPaybill?: string | null;
  businessPermitExpiresAt?: string | null;
  traLicenceExpiresAt?: string | null;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  phoneVerifiedAt?: string | null;
  emailVerifiedAt?: string | null;
  rejectionReason?: string | null;
  amenities?: string[] | null;
  countyId?: string | null;
  townId?: string | null;
  countyName?: string | null;
  townName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  provider: ProviderDetail;
  hardGates?: {
    passed: boolean;
    gates: Array<{
      id: string;
      label: string;
      ok: boolean;
      detail?: string;
    }>;
    failingLabels: string[];
  };
  autoApproveEnabled?: boolean;
  members: Member[];
  listings: ListingRow[];
  bookings: BookingRow[];
  payouts: Array<{
    id: string;
    amount: number;
    commission: number;
    status: string;
    createdAt: string;
  }>;
  supplierOrders: Array<{
    id: string;
    status: string;
    totalAmount: number;
    quantity: number;
    createdAt: string;
    supplier: { name: string } | null;
  }>;
  history: HistoryEntry[];
  stats: {
    listingCount: number;
    publishedCount: number;
    bookingCount: number;
    revenue: number;
    memberCount: number;
  };
};

type Toast = { id: number; message: string; tone: "success" | "error" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sand text-ink-muted",
  PENDING_REVIEW: "bg-sun/20 text-ink",
  PUBLISHED: "bg-lake text-sand",
  SUSPENDED: "bg-red-100 text-red-700",
};

function label(v: string) {
  return v.toLowerCase().replace(/_/g, " ");
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AdminProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPending = searchParams.get("from") === "pending";

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(10);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const tid = Date.now() + Math.random();
    setToasts((t) => [...t, { id: tid, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load provider");
        return;
      }
      setError(null);
      setData(body);
      setRate(body.provider?.commissionRate ?? 10);
    } catch {
      setError("Network error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(
    body: Record<string, unknown>,
    success: string,
    opts?: { redirectPending?: boolean },
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(out.error || "Update failed", "error");
        return;
      }
      pushToast(success, "success");
      if (opts?.redirectPending && fromPending) {
        router.push("/admin/approvals");
        return;
      }
      await load();
    } catch {
      pushToast("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="px-4 py-12 sm:px-8">
        <p className="text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-md bg-lake px-3 py-1.5 text-sm text-sand"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-12 sm:px-8">
        <p className="text-sm text-ink-muted">Loading provider…</p>
      </div>
    );
  }

  const p = data.provider;
  const s = data.stats;

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

      <button
        type="button"
        onClick={() =>
          fromPending ? router.push("/admin/approvals") : router.back()
        }
        className="text-sm font-medium text-lake-bright hover:text-lake"
      >
        {fromPending ? "← Back to pending approvals" : "← Back"}
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Provider profile
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-lake">
            {p.name}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            /{p.slug} · signed up {daysAgo(p.createdAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                p.isApproved ? "bg-lake text-sand" : "bg-sun/25 text-ink"
              }`}
            >
              {p.isApproved ? "Approved" : "Awaiting approval"}
            </span>
            <span className="rounded bg-sand px-2 py-0.5 text-xs capitalize text-ink">
              KYC {label(p.kycStatus || "PENDING")}
            </span>
            {p.subscriptionPlan && (
              <span className="rounded bg-sand px-2 py-0.5 text-xs text-ink">
                {p.subscriptionPlan}
              </span>
            )}
          </div>
        </div>

        {p.isApproved && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-sm text-ink-muted">
              Commission
              <input
                type="number"
                min={0}
                max={50}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-16 rounded-md border border-line px-2 py-1 text-sm"
              />
              %
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void patch({ commissionRate: rate }, "Commission updated")
              }
              className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
            >
              Save commission
            </button>
            {p.kycStatus !== "VERIFIED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void patch({ kycStatus: "VERIFIED" }, "KYC verified")
                }
                className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
              >
                Verify KYC
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt(
                  "Rejection reason (shown to the provider):",
                  "Documents incomplete or unclear — please resubmit",
                );
                if (reason == null) return;
                void patch(
                  {
                    isApproved: false,
                    kycStatus: "REJECTED",
                    rejectionReason: reason.trim() || "Documents incomplete",
                  },
                  "Provider rejected",
                );
              }}
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
            >
              Suspend / reject
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {[
          { label: "Listings", value: String(s.listingCount) },
          { label: "Published", value: String(s.publishedCount) },
          { label: "Bookings", value: String(s.bookingCount) },
          {
            label: "Revenue",
            value: `KES ${s.revenue.toLocaleString()}`,
          },
          { label: "Team", value: String(s.memberCount) },
        ].map((stat) => (
          <div key={stat.label} className="admin-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-ink-muted">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {data.hardGates && (
        <section className="admin-card mt-6 rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">
                Hard-gate checklist
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                {data.autoApproveEnabled
                  ? "Auto-approve is ON — providers pass only when every gate is green."
                  : "Auto-approve is OFF — use this list to triage; approve manually."}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                data.hardGates.passed
                  ? "bg-lake/15 text-lake"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {data.hardGates.passed
                ? "All hard gates passed"
                : `${data.hardGates.failingLabels.length} failing`}
            </span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.hardGates.gates.map((g) => (
              <li
                key={g.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  g.ok
                    ? "border-lake/20 bg-lake/5 text-ink"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                <span className="mt-0.5 font-bold" aria-hidden>
                  {g.ok ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-medium">{g.label}</span>
                  {g.detail && !g.ok && (
                    <span className="mt-0.5 block text-xs opacity-80">
                      {g.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!data.hardGates.passed && !p.isApproved && (
            <p className="mt-3 text-xs text-ink-muted">
              Failing: {data.hardGates.failingLabels.join(" · ")}. Fix these
              (or reject with a reason) before trusting auto-approve.
            </p>
          )}
        </section>
      )}

      {(() => {
        const ownerMember = data.members.find((m) => m.role === "OWNER") ?? data.members[0];
        const owner = ownerMember?.user
          ? {
              name: ownerMember.user.name,
              email: ownerMember.user.email,
              phone: ownerMember.user.phone,
            }
          : null;
        return (
          <section className="admin-card mt-6 rounded-xl p-5">
            <AdminProviderSubmission
              business={p}
              owner={owner}
              actions={
                !p.isApproved ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm text-ink">
                      Commission
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                        className="w-16 rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                      />
                      %
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void patch(
                          {
                            isApproved: true,
                            commissionRate: rate,
                            kycStatus: "VERIFIED",
                          },
                          `${p.name} approved — confirmation sent`,
                          { redirectPending: true },
                        )
                      }
                      className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Approve & notify"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt(
                          "Decline reason (shown to the provider):",
                          "Documents incomplete or unclear — please resubmit",
                        );
                        if (reason == null) return;
                        void patch(
                          {
                            isApproved: false,
                            kycStatus: "REJECTED",
                            rejectionReason:
                              reason.trim() || "Documents incomplete",
                          },
                          "Provider declined",
                          { redirectPending: true },
                        );
                      }}
                      className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                ) : undefined
              }
            />
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-ink">After approval (ops)</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Payout and eTIMS settings the provider can complete once approved.
              </p>
              <dl className="mt-2 space-y-2 text-sm text-ink-muted">
                <Row label="Payout phone" value={p.payoutPhone || "— pending"} />
                <Row label="eTIMS" value={p.etimsEnabled ? "Enabled" : "Off (default)"} />
              </dl>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-ink">Public storefront</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Their public business page on Safari Hub (
                <code className="text-[0.7rem]">/providers/…</code>
                ), where travellers see the brand and published listings. It only
                goes live after you approve them.
              </p>
              {p.isApproved ? (
                <Link
                  href={`/providers/${p.slug}`}
                  className="mt-2 inline-block text-sm font-medium text-lake-bright hover:text-lake"
                >
                  Open public storefront →
                </Link>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-ink-muted">
                    Not live for travellers yet — approve first.
                  </p>
                  <Link
                    href={`/providers/${p.slug}`}
                    className="text-sm font-medium text-lake-bright hover:text-lake"
                  >
                    Admin preview →
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="admin-card rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold">Team</h2>
          {data.members.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No members linked.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.members.map((m) => (
                <li key={m.id} className="text-sm">
                  <p className="font-medium">
                    {m.user?.name || m.user?.email || "—"}
                    <span className="ml-2 text-xs font-normal uppercase text-ink-muted">
                      {m.role}
                    </span>
                  </p>
                  <p className="text-ink-muted">
                    {[m.user?.email, m.user?.phone].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section id="listings" className="admin-card mt-4 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Listings
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {data.listings.length}
            </span>
          </h2>
          <Link
            href="/admin/listings"
            className="text-xs font-medium text-lake-bright"
          >
            All listings →
          </Link>
        </div>
        {data.listings.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No listings yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.listings.map((l) => {
              const place = [l.townName, l.countyName]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={l.id}>
                  <Link
                    href={`/admin/listings/${l.id}?from=provider&providerId=${id}`}
                    className="group flex gap-3 rounded-lg border border-line bg-white/50 p-3 transition hover:border-lake-bright hover:shadow-md"
                  >
                    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-md bg-sand">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink group-hover:text-lake">
                          {l.title}
                        </p>
                        <span
                          className={`rounded px-2 py-0.5 text-[0.65rem] capitalize ${
                            STATUS_STYLE[l.status] || "bg-sand"
                          }`}
                        >
                          {label(l.status)}
                        </span>
                        {l.featured && (
                          <span className="rounded-full bg-sun/20 px-2 py-0.5 text-[0.65rem] font-medium text-ink">
                            featured
                          </span>
                        )}
                        {l.isPromoted && (
                          <span className="rounded-full bg-lake/10 px-2 py-0.5 text-[0.65rem] font-medium text-lake">
                            boosted
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {place || "No location"} · {label(l.category)}
                        {l.offerCount != null
                          ? ` · ${l.offerCount} offer${l.offerCount === 1 ? "" : "s"}`
                          : ""}
                        {l.amenityCount
                          ? ` · ${l.amenityCount} amenities`
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
                      {l.offers && l.offers.length > 0 && (
                        <p className="mt-1 text-xs text-ink-muted">
                          Offers:{" "}
                          {l.offers
                            .map(
                              (o) =>
                                `${o.name} (KES ${o.basePrice.toLocaleString()})`,
                            )
                            .join(" · ")}
                        </p>
                      )}
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">
                        <span>
                          {l.photoCount} photo
                          {l.photoCount === 1 ? "" : "s"}
                        </span>
                        <span>
                          {l.fromPrice
                            ? `from KES ${l.fromPrice.toLocaleString()}`
                            : "no price"}
                        </span>
                        <span>added {daysAgo(l.createdAt)}</span>
                      </p>
                    </div>
                    <span className="shrink-0 self-center text-sm font-medium text-lake-bright">
                      Review →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="admin-card rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold">
            Recent bookings
          </h2>
          {data.bookings.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No bookings yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.bookings.map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <span>
                    <span className="font-medium">{b.reference}</span>
                    <span className="text-ink-muted">
                      {" "}
                      · {b.listingTitle}
                    </span>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    KES {b.totalAmount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold">Activity</h2>
          {data.history.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No audit entries.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{h.summary}</p>
                  <p className="text-xs text-ink-muted">
                    {h.actorName || "System"} · {daysAgo(h.createdAt)} ·{" "}
                    {h.action}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(data.payouts.length > 0 || data.supplierOrders.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {data.payouts.length > 0 && (
            <section className="admin-card rounded-xl p-5">
              <h2 className="font-display text-lg font-semibold">Payouts</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.payouts.map((pay) => (
                  <li key={pay.id} className="flex justify-between">
                    <span className="capitalize">{label(pay.status)}</span>
                    <span>
                      KES {pay.amount.toLocaleString()}
                      <span className="text-ink-muted">
                        {" "}
                        (fee {pay.commission})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.supplierOrders.length > 0 && (
            <section className="admin-card rounded-xl p-5">
              <h2 className="font-display text-lg font-semibold">
                Supplier orders
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.supplierOrders.map((o) => (
                  <li key={o.id} className="flex justify-between">
                    <span>
                      {o.supplier?.name || "Supplier"} · qty {o.quantity}
                    </span>
                    <span className="capitalize text-ink-muted">
                      {label(o.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label: title,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line/60 py-1.5 last:border-0">
      <dt className="text-ink-muted">{title}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
