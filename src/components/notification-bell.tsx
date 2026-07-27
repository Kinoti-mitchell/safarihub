"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated" || !enabled) return;
    try {
      const res = await fetch("/api/notifications");
      if (res.status === 401) {
        setEnabled(false);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  }, [status, enabled]);

  useEffect(() => {
    if (status !== "authenticated" || !enabled) return;
    void load();
    const t = setInterval(() => void load(), 45000);
    return () => clearInterval(t);
  }, [load, status, enabled]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (status !== "authenticated") return null;

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    void load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative grid size-9 place-items-center rounded-md text-ink transition hover:bg-lake/10"
        aria-label="Notifications"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-sun px-1 text-[0.6rem] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-lake-bright underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href || "#"}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) {
                      void fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids: [n.id] }),
                      }).then(() => load());
                    }
                  }}
                  className={`block px-3 py-2.5 text-sm transition hover:bg-sand/60 ${
                    n.read ? "opacity-70" : "bg-lake/5"
                  }`}
                >
                  <p className="font-medium text-ink">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-1 text-[0.65rem] text-ink-muted">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
            {!items.length && (
              <li className="px-3 py-8 text-center text-sm text-ink-muted">
                No notifications yet.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
