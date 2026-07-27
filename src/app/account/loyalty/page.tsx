"use client";

import { useEffect, useState } from "react";

type LedgerEntry = {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
};

type LoyaltyAccount = {
  points: number;
  ledger: LedgerEntry[];
};

export default function AccountLoyaltyPage() {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/loyalty");
        const body = await res.json();
        if (!res.ok) setError(body.error || "Failed to load loyalty");
        else {
          setError(null);
          setAccount(body.account);
        }
      } catch {
        setError("Network error — could not load loyalty");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">Loyalty</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Earn points on every completed trip and redeem them on future bookings.
      </p>

      {error && (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading loyalty…</p>
      ) : account ? (
        <>
          <div className="mt-6 flex items-center gap-4 rounded-xl border border-line bg-lake p-6 text-sand">
            <div>
              <p className="text-xs uppercase tracking-wider text-sand/70">
                Points balance
              </p>
              <p className="mt-1 font-display text-4xl font-semibold">
                {account.points.toLocaleString()}
              </p>
            </div>
          </div>

          <h2 className="mt-8 font-display text-lg font-semibold text-ink">
            History
          </h2>
          {account.ledger.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
              No points activity yet. Complete a trip to start earning.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {account.ledger.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{l.reason}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${
                      l.points >= 0 ? "text-lake" : "text-red-700"
                    }`}
                  >
                    {l.points >= 0 ? "+" : ""}
                    {l.points.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
