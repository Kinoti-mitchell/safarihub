"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";
import { safeReturnUrl } from "@/lib/safe-return-url";
import { createTabBind, writeTabBind } from "@/lib/tab-session";

type Mode = "password" | "phone-otp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnUrl(
    searchParams.get("callbackUrl") || searchParams.get("next"),
    "",
  );
  const [mode, setMode] = useState<Mode>("password");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function routeAfterLogin() {
    const me = await fetch("/api/auth/session").then((r) => r.json());
    const role = me?.user?.role as string | undefined;
    if (role === "ADMIN") {
      router.push(returnTo.startsWith("/admin") ? returnTo : "/admin");
    } else if (role === "PROVIDER") {
      router.push(returnTo.startsWith("/provider") ? returnTo : "/provider");
    } else if (returnTo && !returnTo.startsWith("/admin") && !returnTo.startsWith("/provider")) {
      router.push(returnTo);
    } else {
      router.push("/account");
    }
    router.refresh();
  }

  async function sendLoginOtp() {
    setError(null);
    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "phone",
          destination: phone.trim(),
          purpose: "login",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send login code");
        return;
      }
      setOtpId(data.otpId);
      const fill = data.testCode || data.devCode;
      setDevCode(fill ?? null);
      if (fill) setOtpCode(String(fill).replace(/\D/g, "").slice(0, 6));
    } catch {
      setError("Network error — could not send code");
    } finally {
      setSendingOtp(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const tabBind = createTabBind();
    const result = await signIn("credentials", {
      loginMethod: "password",
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
      return;
    }
    writeTabBind(tabBind);
    await routeAfterLogin();
  }

  async function onPhoneOtpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!otpId) {
      setLoading(false);
      setError("Send a login code to your phone first");
      return;
    }
    const tabBind = createTabBind();
    const result = await signIn("credentials", {
      loginMethod: "phone-otp",
      phone: phone.trim(),
      otpId,
      otpCode: otpCode.trim(),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid code or phone number");
      return;
    }
    writeTabBind(tabBind);
    await routeAfterLogin();
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-40 max-w-lg rounded-full bg-cover bg-center opacity-30 blur-sm"
        style={{
          backgroundImage: "url('/hero/elephants-savanna.jpg')",
        }}
      />
      <div className="card relative animate-fade-up p-8 shadow-md">
        <h1 className="font-display text-3xl font-semibold text-lake">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in with email &amp; password, or a one-time code to your phone.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-sand/40 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === "password"
                ? "bg-lake text-sand"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("phone-otp");
              setError(null);
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === "phone-otp"
                ? "bg-lake text-sand"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Phone OTP
          </button>
        </div>

        {mode === "password" ? (
          <>
            <div className="mt-4 rounded-xl border border-line bg-sand/50 p-3 text-xs text-ink-muted">
              <p className="font-semibold text-ink">Demo accounts</p>
              <ul className="mt-1 space-y-0.5">
                <li>Traveler · tourist@safarihub.ke / tourist123</li>
                <li>Provider · provider@safarihub.ke / provider123</li>
                <li>Admin · admin@safarihub.ke / admin123456</li>
              </ul>
            </div>
            <form onSubmit={onPasswordSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-ink">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                <span className="flex items-center justify-between gap-2">
                  Password
                  <Link
                    href="/forgot"
                    className="text-xs font-normal text-lake-bright underline underline-offset-2"
                  >
                    Forgot?
                  </Link>
                </span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
                />
              </label>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-lake py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={onPhoneOtpSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-ink">
              Phone number
              <input
                type="tel"
                inputMode="tel"
                required
                minLength={10}
                autoComplete="tel"
                placeholder="0712 345 678"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setOtpId(null);
                  setDevCode(null);
                }}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
              />
            </label>
            <button
              type="button"
              onClick={() => void sendLoginOtp()}
              disabled={sendingOtp || phone.replace(/\D/g, "").length < 10}
              className="w-full rounded-lg border border-lake px-4 py-2.5 text-sm font-semibold text-lake transition hover:bg-lake/5 disabled:opacity-60"
            >
              {sendingOtp ? "Sending…" : otpId ? "Resend code" : "Send login code"}
            </button>
            {devCode && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                Local test code (never expires):{" "}
                <span className="font-mono font-semibold">{devCode}</span>
              </p>
            )}
            <label className="block text-sm font-medium text-ink">
              SMS code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={4}
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal outline-none transition focus:border-lake-bright focus:ring-2 focus:ring-lake-bright/30"
              />
            </label>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !otpId}
              className="w-full rounded-lg bg-lake py-2.5 text-sm font-semibold text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in with phone"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-ink-muted">
          New here?{" "}
          <Link
            href={
              returnTo
                ? `/register?callbackUrl=${encodeURIComponent(returnTo)}`
                : "/register"
            }
            className="font-medium text-lake-bright underline underline-offset-2 hover:text-lake"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-sm text-ink-muted">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
