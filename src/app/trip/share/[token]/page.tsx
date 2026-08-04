"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Stop = {
  title: string;
  href?: string | null;
  kind?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
};

export default function SharedTripPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [title, setTitle] = useState("Shared trip");
  const [stops, setStops] = useState<Stop[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/trips/share/${token}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Not found");
        setTitle(body.trip?.title || "Shared trip");
        setStops(body.stops || []);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-muted">{error}</p>
        <Link href="/trip" className="mt-4 inline-block text-lake underline">
          Build your own trip
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Shared itinerary</p>
      <ul className="mt-8 space-y-3">
        {stops.map((s, i) => (
          <li
            key={`${s.title}-${i}`}
            className="rounded-xl border border-line bg-white/70 px-4 py-4"
          >
            <p className="text-xs uppercase tracking-wider text-ink-muted">
              Stop {i + 1}
              {s.kind ? ` · ${s.kind}` : ""}
            </p>
            <p className="mt-1 font-display text-lg font-semibold">{s.title}</p>
            {s.href && (
              <Link
                href={s.href}
                className="mt-2 inline-block text-sm font-semibold text-lake underline"
              >
                View / book
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
