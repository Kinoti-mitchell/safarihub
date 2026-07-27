"use client";

import { useCallback, useEffect, useState } from "react";

type InquiryStatus = "NEW" | "REPLIED" | "CLOSED";

type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  createdAt: string;
  listing: { title: string } | null;
  provider: { name: string } | null;
};

type Data = {
  inquiries: Inquiry[];
  summary: Record<InquiryStatus, number>;
};

const FILTERS: { id: "" | InquiryStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "NEW", label: "New" },
  { id: "REPLIED", label: "Replied" },
  { id: "CLOSED", label: "Closed" },
];

const STATUS_STYLES: Record<InquiryStatus, string> = {
  NEW: "bg-sun/20 text-ink",
  REPLIED: "bg-lake/10 text-lake",
  CLOSED: "bg-line/60 text-ink-muted",
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminInboxPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | InquiryStatus>("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/inquiries?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load inbox");
        return;
      }
      setError(null);
      setData(body);
    } catch {
      setError("Network error — could not reach the server");
    }
  }, [status, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const summary = data?.summary;

  return (
    <div className="px-4 py-10 sm:px-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lake">Inbox</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Inquiries and leads from travellers across every listing.
        </p>
      </div>

      {summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["NEW", "REPLIED", "CLOSED"] as InquiryStatus[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus((s) => (s === k ? "" : k))}
              className={`rounded-xl border p-4 text-left transition ${
                status === k
                  ? "border-lake-bright bg-white shadow-sm"
                  : "border-line bg-white/70 hover:border-lake-bright"
              }`}
            >
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                {k.toLowerCase()}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {summary[k]}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              onClick={() => setStatus(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                status === f.id
                  ? "bg-lake text-sand"
                  : "bg-white/70 text-ink-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, listing…"
          className="ml-auto w-full max-w-xs rounded-md border border-line px-3 py-1.5 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
        />
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

      {!data && !error && (
        <p className="mt-6 text-sm text-ink-muted">Loading inbox…</p>
      )}

      {data && !error && (
        <div className="mt-6">
          {data.inquiries.length === 0 ? (
            <div className="border border-dashed border-line bg-white/40 px-4 py-12 text-center text-sm text-ink-muted">
              No messages{status ? ` in ${status.toLowerCase()}` : ""} right now.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.inquiries.map((i) => (
                <li
                  key={i.id}
                  className="rounded-lg border border-line bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{i.name}</p>
                      <p className="text-sm text-ink-muted">
                        {[i.email, i.phone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[i.status]}`}
                      >
                        {i.status.toLowerCase()}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {timeAgo(i.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-ink">
                    {i.message}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {i.listing?.title || "Listing removed"}
                    {i.provider?.name ? ` · ${i.provider.name}` : ""}
                  </p>
                  {i.reply && (
                    <p className="mt-2 rounded-md bg-sand/60 px-3 py-2 text-sm text-ink">
                      <span className="font-medium">Reply:</span> {i.reply}
                    </p>
                  )}
                  <div className="mt-3 flex gap-3 text-sm">
                    <a
                      href={`mailto:${i.email}`}
                      className="font-medium text-lake-bright hover:text-lake"
                    >
                      Email traveller →
                    </a>
                    {i.phone && (
                      <a
                        href={`tel:${i.phone}`}
                        className="font-medium text-lake-bright hover:text-lake"
                      >
                        Call →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
