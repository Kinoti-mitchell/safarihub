"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Audience = "ALL" | "TOURIST" | "PROVIDER";
type Toast = { id: number; message: string; tone: "success" | "error" };

type Announcement = {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  audience: Audience;
  active: boolean;
  createdAt: string;
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: "Everyone",
  TOURIST: "Tourists",
  PROVIDER: "Providers",
};

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AdminAdsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [audience, setAudience] = useState<Audience>("ALL");
  const [showForm, setShowForm] = useState(false);

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
      const res = await fetch("/api/admin/announcements");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load broadcasts");
        return;
      }
      setError(null);
      setItems(body.announcements || []);
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setActionBusy("create", true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          body: fd.get("body"),
          linkUrl: fd.get("linkUrl") || "",
          audience,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not publish", "error");
        return;
      }
      pushToast("Broadcast pushed", "success");
      form.reset();
      setAudience("ALL");
      setShowForm(false);
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setActionBusy("create", false);
    }
  }

  async function toggle(a: Announcement) {
    const key = `toggle:${a.id}`;
    setActionBusy(key, true);
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast(body.error || "Could not update", "error");
        return;
      }
      pushToast(a.active ? "Paused" : "Activated", "success");
      await load();
    } finally {
      setActionBusy(key, false);
    }
  }

  async function remove(a: Announcement) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    const key = `delete:${a.id}`;
    setActionBusy(key, true);
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast(body.error || "Could not delete", "error");
        return;
      }
      pushToast("Deleted", "success");
      await load();
    } finally {
      setActionBusy(key, false);
    }
  }

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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Ads &amp; broadcasts
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Push an advertisement or announcement to a group of users. Active
            broadcasts appear as a banner on their dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md"
        >
          {showForm ? "Close" : "+ New broadcast"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="mt-8 max-w-2xl animate-fade-up space-y-3 rounded-lg border border-line bg-white/70 p-5 shadow-sm"
        >
          <h2 className="font-display text-xl">New broadcast</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Send to
            </label>
            <div className="flex gap-1">
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                    audience === a
                      ? "bg-lake text-sand"
                      : "bg-sand/60 text-ink-muted hover:text-ink"
                  }`}
                >
                  {AUDIENCE_LABEL[a]}
                </button>
              ))}
            </div>
          </div>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Headline"
            className="w-full rounded-md border border-line px-3 py-2 focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
          />
          <textarea
            name="body"
            required
            maxLength={1000}
            rows={4}
            placeholder="Message shown to users…"
            className="w-full rounded-md border border-line px-3 py-2 focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
          />
          <input
            name="linkUrl"
            type="url"
            placeholder="Link (optional) — https://…"
            className="w-full rounded-md border border-line px-3 py-2 focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy.has("create")}
              className="rounded-md bg-lake px-4 py-2 text-sm font-medium text-sand transition hover:bg-lake-bright disabled:opacity-50"
            >
              {busy.has("create") ? "Pushing…" : "Push broadcast"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-lake-bright"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-10">
        <h2 className="font-display text-xl">Sent broadcasts</h2>
          {error && (
            <div className="mt-3 border border-red-200 bg-red-50 p-4 text-red-700">
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
            <p className="mt-3 text-sm text-ink-muted">Loading…</p>
          )}
          {loaded && !error && items.length === 0 && (
            <div className="mt-3 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
              No broadcasts yet. Create one to reach your users.
            </div>
          )}
          {loaded && items.length > 0 && (
            <ul className="mt-3 space-y-3">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-line bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{a.title}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.active
                              ? "bg-lake/10 text-lake"
                              : "bg-line/60 text-ink-muted"
                          }`}
                        >
                          {a.active ? "Live" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">{a.body}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {AUDIENCE_LABEL[a.audience]} · {daysAgo(a.createdAt)}
                        {a.linkUrl ? " · has link" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busy.has(`toggle:${a.id}`)}
                        onClick={() => void toggle(a)}
                        className="rounded-md border border-line px-3 py-1.5 text-sm transition hover:bg-sand disabled:opacity-50"
                      >
                        {a.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={busy.has(`delete:${a.id}`)}
                        onClick={() => void remove(a)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
  );
}
