"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type CompliancePayload = {
  kyc: {
    status: string;
    type: string | null;
    kraPin: string | null;
    etimsEnabled: boolean;
    rejectionReason?: string | null;
    rejectedAt?: string | null;
    isApproved?: boolean;
  };
  platformEtims: boolean;
  etimsMode: string;
  queue: Array<{
    id: string;
    receiptNumber: string | null;
    amount: number;
    vatAmount: number;
    status: string;
    kraRef: string | null;
    createdAt: string;
  }>;
  eligibleBookings: Array<{
    id: string;
    reference: string;
    receiptNumber: string | null;
    totalAmount: number;
    vatAmount: number | null;
    listing: { title: string } | null;
  }>;
};

export default function CompliancePage() {
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState("Platform");

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/compliance");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Failed to load");
      return;
    }
    setError(null);
    setData(body);
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

  async function savePin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("pin");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/provider/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "savePin",
        kraPin: form.get("kraPin"),
        etimsEnabled: form.get("etimsEnabled") === "on",
      }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Save failed");
      return;
    }
    setMsg("Compliance settings saved");
    void load();
  }

  async function queueBooking(bookingId: string) {
    setBusy(bookingId);
    const res = await fetch("/api/provider/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "queue", bookingId }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Queue failed");
      return;
    }
    setMsg(body.message || "Queued for eTIMS");
    void load();
  }

  async function markSubmitted(id: string) {
    const kraRef = window.prompt("KRA / eTIMS reference (optional)") || "";
    setBusy(id);
    const res = await fetch("/api/provider/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markSubmitted", id, kraRef }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Update failed");
      return;
    }
    setMsg("Marked submitted");
    void load();
  }

  async function resubmitVerification(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("resubmit");
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/provider/verification/resubmit", {
      method: "POST",
      body: form,
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Resubmit failed");
      return;
    }
    setMsg(body.message || "Resubmitted for review");
    e.currentTarget.reset();
    void load();
  }

  if (!data && !error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink-muted">
        Loading compliance…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Compliance
      </h1>
      <p className="mt-2 text-ink-muted">
        KYC for trust, and an eTIMS queue so paid receipts become audit-ready —
        retention through compliance, not just listings.
      </p>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}

      {data && (
        <>
          <section className="mt-8 border border-line bg-white/70 p-5">
            <h2 className="font-display text-xl font-semibold">KYC</h2>
            <p className="mt-2 text-sm">
              Status:{" "}
              <span className="font-semibold text-ink">{data.kyc.status}</span>
              {data.kyc.type ? ` · ${data.kyc.type}` : ""}
            </p>
            {data.kyc.status === "REJECTED" && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold">Rejected by admin</p>
                <p className="mt-1">
                  {data.kyc.rejectionReason ||
                    "Update your documents and resubmit below."}
                </p>
              </div>
            )}
            {data.kyc.status === "REJECTED" && (
              <form
                onSubmit={resubmitVerification}
                encType="multipart/form-data"
                className="mt-4 space-y-3 border-t border-line pt-4"
              >
                <p className="text-sm font-medium text-ink">
                  Resubmit verification documents
                </p>
                <label className="block text-sm">
                  Owner ID
                  <input name="ownerIdDoc" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="block text-sm">
                  Selfie holding ID
                  <input name="selfieDoc" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
                </label>
                <label className="block text-sm">
                  KRA PIN document
                  <input name="kraPinDoc" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="block text-sm">
                  Certificate of incorporation
                  <input name="registrationCert" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="block text-sm">
                  Business permit
                  <input name="businessPermit" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="block text-sm">
                  Permit expiry
                  <input name="businessPermitExpiresAt" type="date" className="mt-1 w-full rounded border border-line px-3 py-2" />
                </label>
                <label className="block text-sm">
                  M-Pesa till / paybill
                  <input name="mpesaTillOrPaybill" className="mt-1 w-full rounded border border-line px-3 py-2" />
                </label>
                <button
                  type="submit"
                  disabled={busy === "resubmit"}
                  className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                >
                  {busy === "resubmit" ? "Submitting…" : "Resubmit for review"}
                </button>
              </form>
            )}
            {data.kyc.status !== "REJECTED" && (
              <p className="mt-1 text-sm text-ink-muted">
                Verified by {platformName} admin.
              </p>
            )}
          </section>

          <section className="mt-6 border border-line bg-white/70 p-5">
            <h2 className="font-display text-xl font-semibold">eTIMS / KRA</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Mode: {data.etimsMode}
              {data.platformEtims
                ? " · platform module on"
                : " · platform module off (manual queue still works)"}
              {data.etimsMode === "sandbox"
                ? " · sandbox auto-assigns a KRA ref on queue"
                : data.etimsMode === "live"
                  ? " · live posts to the configured eTIMS API"
                  : " · mark submitted when you have the KRA ref"}
            </p>
            <form onSubmit={savePin} className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                KRA PIN
                <input
                  name="kraPin"
                  defaultValue={data.kyc.kraPin || ""}
                  placeholder="P000000000X"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="etimsEnabled"
                  type="checkbox"
                  defaultChecked={data.kyc.etimsEnabled}
                />
                Queue paid receipts for eTIMS
              </label>
              <button
                type="submit"
                disabled={busy === "pin"}
                className="rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
              >
                Save
              </button>
            </form>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">
              Eligible receipts
            </h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {data.eligibleBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span>
                    <span className="font-medium">{b.reference}</span>
                    <span className="text-ink-muted">
                      {" "}
                      · {b.listing?.title} · KES{" "}
                      {Number(b.totalAmount).toLocaleString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() => void queueBooking(b.id)}
                    className="rounded-md border border-lake px-3 py-1.5 text-xs font-semibold text-lake disabled:opacity-60"
                  >
                    Queue eTIMS
                  </button>
                </li>
              ))}
              {data.eligibleBookings.length === 0 && (
                <li className="py-4 text-sm text-ink-muted">
                  No paid receipts waiting — complete bookings first.
                </li>
              )}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">Queue</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.queue.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-line bg-white/60 px-3 py-2"
                >
                  <span>
                    {q.receiptNumber || "—"} · KES{" "}
                    {q.amount.toLocaleString()} ·{" "}
                    <span className="font-medium">{q.status}</span>
                    {q.kraRef ? ` · ${q.kraRef}` : ""}
                  </span>
                  {q.status === "QUEUED" && (
                    <button
                      type="button"
                      disabled={busy === q.id}
                      onClick={() => void markSubmitted(q.id)}
                      className="text-xs font-semibold text-lake-bright"
                    >
                      Mark submitted
                    </button>
                  )}
                </li>
              ))}
              {data.queue.length === 0 && (
                <li className="text-ink-muted">Queue empty.</li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
