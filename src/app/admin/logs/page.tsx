"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type LogEntry = {
  id: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

const ENTITY_TYPES = [
  "Provider",
  "Listing",
  "County",
  "User",
  "Event",
  "TravelPackage",
];

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AdminLogsInner() {
  const searchParams = useSearchParams();
  const actorId = searchParams.get("actorId") || "";
  const actorLabel = searchParams.get("actor") || "";

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (entityType) params.set("entityType", entityType);
      if (actorId) params.set("actorId", actorId);
      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load logs");
        return;
      }
      setError(null);
      setLogs(body.logs || []);
    } catch {
      setError("Network error — could not load logs");
    } finally {
      setLoading(false);
    }
  }, [query, entityType, actorId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Activity logs
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every admin action — approvals, publishes, market changes and role
            edits — recorded here.
          </p>
          {actorId && (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-lake/30 bg-lake/10 px-3 py-1 text-sm text-lake">
              Activity by {actorLabel || "selected user"}
              <Link
                href="/admin/logs"
                aria-label="Clear user filter"
                className="rounded-full px-1 text-xs font-semibold text-lake/70 transition hover:bg-lake/15 hover:text-lake"
              >
                ✕
              </Link>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-lake-bright"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actions, summaries, actors…"
          className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm"
        />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading logs…</p>
      ) : logs.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          {actorId
            ? "No recorded activity for this user yet."
            : "No activity recorded yet. Actions like approving a provider or publishing a listing will appear here."}
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap items-start justify-between gap-2 border border-line bg-white/70 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-lake/10 px-1.5 py-0.5 font-mono text-xs text-lake">
                    {log.action}
                  </span>
                  <span className="rounded bg-sand px-1.5 py-0.5 text-xs text-ink-muted">
                    {log.entityType}
                  </span>
                </div>
                <p className="mt-1">{log.summary}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {log.actorName || log.actorEmail || "System"}
                </p>
              </div>
              <time
                className="shrink-0 text-xs text-ink-muted"
                dateTime={log.createdAt}
                title={new Date(log.createdAt).toLocaleString()}
              >
                {timeAgo(log.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminLogsPage() {
  return (
    <Suspense
      fallback={<p className="px-4 py-10 text-sm text-ink-muted sm:px-8">Loading logs…</p>}
    >
      <AdminLogsInner />
    </Suspense>
  );
}
