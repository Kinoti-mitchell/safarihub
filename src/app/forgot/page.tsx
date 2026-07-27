"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    const email = String(new FormData(e.currentTarget).get("email"));
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setMsg(data.message || "Check your email for a reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-8 shadow-md">
        <h1 className="font-display text-3xl font-semibold text-lake">
          Forgot password
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enter your email and we&apos;ll send a reset link if an account
          exists.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {msg && <p className="text-sm text-lake-bright">{msg}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-lake py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/login" className="text-lake-bright underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
