"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Conversation = {
  id: string;
  subject: string | null;
  status: string;
  lastMessageAt: string;
  unreadForTraveler: number;
  listing?: { id: string; title: string } | null;
  provider?: { name: string } | null;
};

type Message = {
  id: string;
  body: string;
  senderRole: string;
  createdAt: string;
  sender?: { name: string | null } | null;
};

export default function AccountMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load messages");
      return;
    }
    setConversations(data.conversations || []);
  }, []);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not open thread");
      return;
    }
    setActive(data.conversation);
    setMessages(data.messages || []);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadForTraveler: 0 } : c)),
    );
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function reply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeId) return;
    const form = e.currentTarget;
    const message = String(new FormData(form).get("message") || "").trim();
    if (!message) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send");
        return;
      }
      form.reset();
      await openThread(activeId);
      await loadList();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">Messages</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Questions you asked providers about listings before booking.
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <ul className="space-y-2 lg:col-span-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void openThread(c.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  c.id === activeId
                    ? "border-lake bg-lake/5"
                    : "border-line bg-white/70 hover:border-lake-bright"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium">
                    {c.listing?.title || c.subject || "Listing"}
                  </p>
                  {c.unreadForTraveler > 0 && (
                    <span className="rounded-full bg-sun px-2 py-0.5 text-[0.65rem] font-semibold">
                      {c.unreadForTraveler}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-muted">
                  {c.provider?.name || "Provider"}
                </p>
              </button>
            </li>
          ))}
          {!conversations.length && (
            <li className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
              No messages yet.{" "}
              <Link href="/browse" className="text-lake-bright underline">
                Browse stays
              </Link>{" "}
              and ask a provider from a listing page.
            </li>
          )}
        </ul>

        <div className="rounded-xl border border-line bg-white/70 p-4 lg:col-span-3">
          {!active ? (
            <p className="py-16 text-center text-sm text-ink-muted">
              Select a conversation.
            </p>
          ) : (
            <>
              <p className="font-display text-lg font-semibold">
                {active.listing?.title}
              </p>
              <ul className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto">
                {messages.map((m) => {
                  const mine = m.senderRole === "TOURIST";
                  return (
                    <li
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? "bg-lake text-sand" : "bg-sand-deep/40"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p
                          className={`mt-1 text-[0.65rem] ${
                            mine ? "text-sand/70" : "text-ink-muted"
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <form onSubmit={(e) => void reply(e)} className="mt-4 space-y-2">
                <textarea
                  name="message"
                  required
                  rows={3}
                  placeholder="Continue the conversation…"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
