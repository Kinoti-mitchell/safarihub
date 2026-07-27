"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
};

const DISMISS_KEY = "sh-dismissed-announcements";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(readDismissed());
    void (async () => {
      try {
        const res = await fetch("/api/announcements");
        if (!res.ok) return;
        const body = await res.json();
        setItems(body.announcements || []);
      } catch {
        /* silent — banners are non-critical */
      }
    })();
  }, []);

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage errors */
    }
  }

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-6 sm:px-8">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-xl border border-sun/40 bg-sun/10 px-4 py-3"
        >
          <span
            aria-hidden
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-sun text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{a.title}</p>
            <p className="text-sm text-ink-muted">{a.body}</p>
            {a.linkUrl && (
              <Link
                href={a.linkUrl}
                className="mt-1 inline-block text-sm font-medium text-lake-bright hover:text-lake"
              >
                Learn more →
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-ink-muted transition hover:bg-sun/20 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
