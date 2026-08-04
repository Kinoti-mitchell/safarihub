"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Conversation = {
  id: string;
  subject: string | null;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  lastMessageAt: string;
  unreadForProvider: number;
  listing?: { id: string; title: string } | null;
  traveler?: { name: string | null; email: string } | null;
};

type Message = {
  id: string;
  body: string;
  senderRole: string;
  createdAt: string;
  sender?: { name: string | null } | null;
};

type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  reply?: string | null;
  status: string;
  createdAt: string;
  listing?: { title?: string } | null;
};

type Tab = "messages" | "leads";

export default function ProviderInboxPage() {
  const [tab, setTab] = useState<Tab>("messages");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load inbox");
      return;
    }
    setError(null);
    setConversations(data.conversations || []);
  }, []);

  const loadLeads = useCallback(async () => {
    const res = await fetch("/api/inquiries");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load leads");
      return;
    }
    setInquiries(data.inquiries || []);
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
      prev.map((c) => (c.id === id ? { ...c, unreadForProvider: 0 } : c)),
    );
  }, []);

  useEffect(() => {
    void loadList();
    void loadLeads();
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tab") === "leads"
    ) {
      setTab("leads");
    }
  }, [loadList, loadLeads]);

  async function reply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeId) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const message = String(fd.get("message") || "").trim();
    if (!message) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          close: fd.get("close") === "on",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send reply");
        return;
      }
      form.reset();
      await openThread(activeId);
      await loadList();
    } finally {
      setSending(false);
    }
  }

  async function replyLead(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: form.get("reply") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save reply");
        return;
      }
      setMsg("Lead reply saved");
      await loadLeads();
    } finally {
      setSending(false);
    }
  }

  const unreadTotal = conversations.reduce(
    (s, c) => s + (c.unreadForProvider || 0),
    0,
  );
  const newLeads = inquiries.filter((i) => i.status === "NEW").length;

  return (
    <div className="px-4 py-10 sm:px-8">
      <h1 className="font-display text-3xl font-semibold text-lake">Inbox</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Guest messages and older inquiry leads in one place.
        {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""}
        {newLeads > 0 ? ` · ${newLeads} new lead${newLeads === 1 ? "" : "s"}` : ""}
      </p>

      <div className="mt-4 flex gap-1 rounded-lg border border-line bg-white/70 p-0.5 w-fit text-sm">
        <button
          type="button"
          onClick={() => setTab("messages")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            tab === "messages" ? "bg-lake text-sand" : "text-ink-muted"
          }`}
        >
          Messages{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("leads")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            tab === "leads" ? "bg-lake text-sand" : "text-ink-muted"
          }`}
        >
          Leads{newLeads > 0 ? ` (${newLeads})` : ""}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-lake-bright">{msg}</p>}
      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {tab === "messages" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <ul className="space-y-2 lg:col-span-2">
            {conversations.map((c) => {
              const name =
                c.guestName || c.traveler?.name || c.traveler?.email || "Guest";
              const selected = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(c.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-lake bg-lake/5"
                        : "border-line bg-white/70 hover:border-lake-bright"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-ink">{name}</p>
                      {c.unreadForProvider > 0 && (
                        <span className="rounded-full bg-sun px-2 py-0.5 text-[0.65rem] font-semibold text-ink">
                          {c.unreadForProvider}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-muted">
                      {c.listing?.title || c.subject || "Listing"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {new Date(c.lastMessageAt).toLocaleString()} ·{" "}
                      {c.status.toLowerCase()}
                    </p>
                  </button>
                </li>
              );
            })}
            {!conversations.length && (
              <li className="rounded-xl border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
                No messages yet. When a tourist asks a question on your listing,
                it appears here.
              </li>
            )}
          </ul>

          <div className="rounded-xl border border-line bg-white/70 p-4 lg:col-span-3">
            {!activeId || !active ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                Select a conversation to reply.
              </p>
            ) : (
              <>
                <div className="border-b border-line pb-3">
                  <p className="font-display text-lg font-semibold text-ink">
                    {active.listing?.title || active.subject || "Conversation"}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {active.guestName || active.traveler?.name || "Guest"}
                    {active.guestEmail || active.traveler?.email
                      ? ` · ${active.guestEmail || active.traveler?.email}`
                      : ""}
                  </p>
                </div>
                <ul className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                  {messages.map((m) => {
                    const mine =
                      m.senderRole === "PROVIDER" || m.senderRole === "ADMIN";
                    return (
                      <li
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? "bg-lake text-sand"
                              : "bg-sand-deep/40 text-ink"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p
                            className={`mt-1 text-[0.65rem] ${
                              mine ? "text-sand/70" : "text-ink-muted"
                            }`}
                          >
                            {mine ? "You" : m.sender?.name || "Guest"} ·{" "}
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {active.status !== "CLOSED" ? (
                  <form
                    onSubmit={(e) => void reply(e)}
                    className="mt-4 space-y-2"
                  >
                    <textarea
                      name="message"
                      required
                      rows={3}
                      placeholder="Write your answer…"
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm text-ink-muted">
                        <input
                          type="checkbox"
                          name="close"
                          className="accent-lake"
                        />
                        Close after sending
                      </label>
                      <button
                        type="submit"
                        disabled={sending}
                        className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                      >
                        {sending ? "Sending…" : "Send reply"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-ink-muted">
                    This thread is closed. The guest can reopen it by messaging
                    again from the listing.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {inquiries.map((inq) => (
            <li key={inq.id} className="rounded-xl border border-line bg-white/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {inq.name} · {inq.listing?.title || "Listing"}
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
                  onSubmit={(e) => void replyLead(e, inq.id)}
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
                    disabled={sending}
                    className="rounded-md bg-lake px-3 py-2 text-sm text-sand disabled:opacity-60"
                  >
                    Send reply
                  </button>
                </form>
              )}
            </li>
          ))}
          {!inquiries.length && (
            <li className="rounded-xl border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
              No older inquiry leads. New guest questions arrive under Messages.
            </li>
          )}
          <li className="text-center text-xs text-ink-muted">
            Prefer threaded chat? Guests messaging from a listing open under{" "}
            <button
              type="button"
              onClick={() => setTab("messages")}
              className="font-medium text-lake-bright underline"
            >
              Messages
            </button>
            .
          </li>
        </ul>
      )}
    </div>
  );
}
