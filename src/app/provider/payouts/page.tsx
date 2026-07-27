"use client";

import { useEffect, useState } from "react";

export default function ProviderPayoutsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/provider/payouts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Payouts
      </h1>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="mt-4 text-ink-muted">Loading…</p>}
      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="border border-line bg-white/70 p-4">
              <p className="text-xs uppercase text-ink-muted">Total net</p>
              <p className="font-display text-2xl">
                KES {Number(data.totalNet || 0).toLocaleString()}
              </p>
            </div>
            <div className="border border-line bg-white/70 p-4">
              <p className="text-xs uppercase text-ink-muted">Commission</p>
              <p className="font-display text-2xl">
                KES {Number(data.totalCommission || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <ul className="mt-8 space-y-3">
            {data.payouts?.map((p: any) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-line bg-white/70 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {p.booking?.listing?.title || "Booking"} · {p.booking?.reference}
                  </p>
                  <p className="text-ink-muted">
                    {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                  </p>
                </div>
                <p className="font-semibold text-lake">
                  KES {p.amount.toLocaleString()}
                </p>
              </li>
            ))}
            {!data.payouts?.length && (
              <li className="text-sm text-ink-muted">No payouts yet.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
