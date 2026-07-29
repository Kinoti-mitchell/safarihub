"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AddBusinessWizard } from "@/components/add-business-wizard";

type Business = {
  id: string;
  name: string;
  slug: string;
  isApproved: boolean;
  role: string;
};

export default function BusinessesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/provider/businesses");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load businesses");
      return;
    }
    setBusinesses(data.businesses || []);
    setActiveId(data.activeProviderId || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchTo(providerId: string) {
    setBusy(true);
    const res = await fetch("/api/provider/businesses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not switch");
      return;
    }
    setActiveId(providerId);
    router.refresh();
    window.location.href = "/provider";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Your businesses
      </h1>
      <p className="mt-2 text-ink-muted">
        One Safari Hub account can own and manage multiple hospitality
        businesses — hotels, restaurants, tours, transfers. Each new business
        uses the same stepped verification as signup before an admin can approve
        it.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-lg border border-lake/30 bg-lake/5 px-3 py-2 text-sm text-lake">
          {msg}
        </p>
      )}

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {businesses.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                {b.name}
                {b.id === activeId && (
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-lake-bright">
                    Active
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-muted">
                {b.role} · {b.isApproved ? "Approved" : "Awaiting approval"} · /
                {b.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.id !== activeId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void switchTo(b.id)}
                  className="rounded-md border border-lake px-3 py-1.5 text-sm font-semibold text-lake disabled:opacity-60"
                >
                  Switch to this
                </button>
              )}
              {b.id === activeId && (
                <>
                  <Link
                    href="/provider/business"
                    className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-lake-bright"
                  >
                    Edit profile
                  </Link>
                  <Link
                    href="/provider/listings"
                    className="rounded-md bg-lake px-3 py-1.5 text-sm font-semibold text-sand"
                  >
                    Manage listings
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
        {businesses.length === 0 && (
          <li className="py-6 text-sm text-ink-muted">
            No businesses yet — create your first below.
          </li>
        )}
      </ul>

      {!showForm && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError(null);
              setMsg(null);
            }}
            className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand"
          >
            + Add another business
          </button>
        </div>
      )}

      {showForm && (
        <AddBusinessWizard
          accountEmail={session?.user?.email}
          accountPhone={
            (session?.user as { phone?: string | null } | undefined)?.phone
          }
          onCancel={() => setShowForm(false)}
          onCreated={(message) => {
            setMsg(message);
            setShowForm(false);
            void load().then(() => {
              window.location.href = "/provider";
            });
          }}
        />
      )}
    </div>
  );
}
