"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function ProviderInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/inquiries");
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setInquiries(data.inquiries || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function reply(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: form.get("reply") }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setMsg("Reply saved");
      void load();
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">
        Inquiries
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Older leads from before the inbox. Prefer{" "}
        <Link
          href="/provider/inbox"
          className="font-medium text-lake-bright underline decoration-lake-bright/40 underline-offset-2"
        >
          Inbox
        </Link>{" "}
        for new guest messages.
      </p>
      {msg && <p className="mt-3 text-sm text-lake-bright">{msg}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <ul className="mt-8 space-y-6">
        {inquiries.map((inq) => (
          <li key={inq.id} className="border border-line bg-white/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {inq.name} · {inq.listing?.title}
                </p>
                <p className="text-sm text-ink-muted">
                  {inq.email}
                  {inq.phone ? ` · ${inq.phone}` : ""} · {inq.status}
                </p>
              </div>
              <p className="text-xs text-ink-muted">
                {new Date(inq.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap">{inq.message}</p>
            {inq.reply && (
              <p className="mt-2 text-sm text-lake">Your reply: {inq.reply}</p>
            )}
            {inq.status !== "CLOSED" && (
              <form
                onSubmit={(e) => void reply(e, inq.id)}
                className="mt-4 space-y-2"
              >
                <textarea
                  name="reply"
                  required
                  rows={3}
                  placeholder="Reply to this lead…"
                  defaultValue={inq.reply || ""}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-lake px-3 py-2 text-sm text-sand"
                >
                  Send reply
                </button>
              </form>
            )}
          </li>
        ))}
        {!inquiries.length && (
          <li className="text-sm text-ink-muted">No inquiries yet.</li>
        )}
      </ul>
    </div>
  );
}
