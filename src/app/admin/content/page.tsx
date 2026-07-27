"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" };
type County = { id: string; name: string };

export default function AdminContentPage() {
  const [counties, setCounties] = useState<County[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showEvent, setShowEvent] = useState(false);
  const [showPackage, setShowPackage] = useState(false);

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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/counties");
        const c = await res.json();
        setCounties(c.counties || []);
      } catch {
        /* non-fatal — county select stays empty */
      }
    })();
  }, []);

  async function submit(
    key: string,
    url: string,
    payload: unknown,
    form: HTMLFormElement,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    setActionBusy(key, true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not save", "error");
        return;
      }
      pushToast(successMessage, "success");
      form.reset();
      onSuccess?.();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setActionBusy(key, false);
    }
  }

  function onCreateEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void submit(
      "event",
      "/api/events",
      {
        title: fd.get("title"),
        startsAt: fd.get("startsAt"),
        venue: fd.get("venue"),
        countyId: fd.get("countyId") || undefined,
        isPublished: true,
      },
      form,
      "Event published",
      () => setShowEvent(false),
    );
  }

  function onCreatePackage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void submit(
      "package",
      "/api/packages",
      {
        title: fd.get("title"),
        price: Number(fd.get("price")),
        days: Number(fd.get("days") || 1),
        description: fd.get("description"),
      },
      form,
      "Package published",
      () => setShowPackage(false),
    );
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
            Content
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Publish events and travel packages that appear across the
            marketplace.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowEvent((v) => !v)}
            className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md"
          >
            {showEvent ? "Close event" : "+ Create event"}
          </button>
          <button
            type="button"
            onClick={() => setShowPackage((v) => !v)}
            className="rounded-md border border-lake px-4 py-2.5 text-sm font-semibold text-lake transition hover:bg-lake/5"
          >
            {showPackage ? "Close package" : "+ Create package"}
          </button>
        </div>
      </div>

      {(showEvent || showPackage) && (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {showEvent && (
        <form
          onSubmit={onCreateEvent}
          className="animate-fade-up space-y-2 rounded-lg border border-line bg-white/70 p-4 shadow-sm"
        >
          <h2 className="font-display text-xl">Create event</h2>
          <input
            name="title"
            required
            placeholder="Title"
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <input
            name="startsAt"
            type="datetime-local"
            required
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <input
            name="venue"
            placeholder="Venue"
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <select
            name="countyId"
            className="w-full rounded-md border border-line px-3 py-2"
          >
            <option value="">County (optional)</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy.has("event")}
            className="rounded-md bg-lake px-3 py-2 text-sm text-sand disabled:opacity-50"
          >
            {busy.has("event") ? "Saving…" : "Publish event"}
          </button>
        </form>
        )}

        {showPackage && (
        <form
          onSubmit={onCreatePackage}
          className="animate-fade-up space-y-2 rounded-lg border border-line bg-white/70 p-4 shadow-sm"
        >
          <h2 className="font-display text-xl">Create package</h2>
          <input
            name="title"
            required
            placeholder="Title"
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <input
            name="price"
            type="number"
            required
            placeholder="Price KES"
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <input
            name="days"
            type="number"
            defaultValue={1}
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <textarea
            name="description"
            placeholder="Description"
            className="w-full rounded-md border border-line px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy.has("package")}
            className="rounded-md bg-lake px-3 py-2 text-sm text-sand disabled:opacity-50"
          >
            {busy.has("package") ? "Saving…" : "Publish package"}
          </button>
        </form>
        )}
      </div>
      )}
    </div>
  );
}
