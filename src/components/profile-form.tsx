"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Profile = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  image: string | null;
  role: string;
  createdAt: string;
};

type Toast = { id: number; message: string; tone: "success" | "error" };

export function ProfileForm() {
  const { update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load profile");
        return;
      }
      const p: Profile = body.user;
      setProfile(p);
      setHasPassword(Boolean(body.hasPassword));
      setName(p.name || "");
      setPhone(p.phone || "");
      setImage(p.image || "");
      setError(null);
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        pushToast(body.error || "Upload failed", "error");
        return;
      }
      setImage(body.url);
      pushToast("Photo uploaded — remember to save", "success");
    } catch {
      pushToast("Network error during upload", "error");
    } finally {
      setUploading(false);
    }
  }

  async function saveDetails() {
    setSavingDetails(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null, image: image || null }),
      });
      const body = await res.json();
      if (!res.ok) {
        pushToast(body.error || "Could not save", "error");
        return;
      }
      setProfile(body.user);
      await update?.({ name: body.user.name, image: body.user.image });
      pushToast("Profile updated", "success");
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setSavingDetails(false);
    }
  }

  async function savePassword() {
    if (next !== confirm) {
      pushToast("New passwords do not match", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: current || undefined,
          newPassword: next,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        pushToast(body.error || "Could not update password", "error");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setHasPassword(true);
      pushToast("Password updated", "success");
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  const initial = (name || profile?.email || "?").charAt(0).toUpperCase();
  const memberSince = profile
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : "";

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

      <div>
        <h1 className="font-display text-3xl font-semibold text-lake">My profile</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your personal details, photo and password.
        </p>
      </div>

      {error && (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-red-700">
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
        <p className="mt-6 text-sm text-ink-muted">Loading profile…</p>
      )}

      {loaded && !error && profile && (
        <div className="mt-6 grid max-w-3xl gap-6">
          {/* Identity + details */}
          <section className="rounded-xl border border-line bg-white/70 p-5">
            <h2 className="font-display text-xl font-semibold text-ink">Details</h2>
            <div className="mt-4 flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-lake text-2xl font-semibold text-sand">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="Avatar" className="size-full object-cover" />
                ) : (
                  initial
                )}
              </span>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-medium transition hover:border-lake-bright">
                  {uploading ? "Uploading…" : image ? "Change photo" : "Upload photo"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onAvatar}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage("")}
                    className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +254 700 000000"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  value={profile.email}
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-md border border-line bg-sand/40 px-3 py-2 text-sm text-ink-muted"
                />
              </label>
              <div className="block">
                <span className="text-sm font-medium text-ink">Account</span>
                <p className="mt-1 rounded-md border border-line bg-sand/40 px-3 py-2 text-sm capitalize text-ink-muted">
                  {profile.role.toLowerCase()} · member since {memberSince}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => void saveDetails()}
                disabled={savingDetails}
                className="rounded-lg bg-lake px-4 py-2 text-sm font-medium text-sand transition hover:bg-lake-bright disabled:opacity-50"
              >
                {savingDetails ? "Saving…" : "Save details"}
              </button>
            </div>
          </section>

          {/* Password */}
          <section className="rounded-xl border border-line bg-white/70 p-5">
            <h2 className="font-display text-xl font-semibold text-ink">
              {hasPassword ? "Change password" : "Set a password"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {hasPassword
                ? "Enter your current password and choose a new one."
                : "Your account has no password yet — set one to sign in with email."}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {hasPassword && (
                <label className="block">
                  <span className="text-sm font-medium text-ink">Current</span>
                  <input
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium text-ink">New password</span>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Confirm</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
                />
              </label>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => void savePassword()}
                disabled={savingPassword || !next || !confirm}
                className="rounded-lg bg-lake px-4 py-2 text-sm font-medium text-sand transition hover:bg-lake-bright disabled:opacity-50"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
