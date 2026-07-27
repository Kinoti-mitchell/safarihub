"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: Role;
  roleKey: string | null;
  createdAt: string;
  _count: { bookings: number };
};

type RoleOption = { key: string; label: string; isSystem: boolean };

type Toast = { id: number; message: string; tone: "success" | "error" };

const effectiveKey = (u: AdminUser): string => u.roleKey || u.role;

function AdminUsersInner() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const initialRole: Role | "" =
    roleParam && (ROLES as readonly string[]).includes(roleParam)
      ? (roleParam as Role)
      : "";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">(initialRole);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const labelForKey = useCallback(
    (key: string): string =>
      roleOptions.find((r) => r.key === key)?.label ||
      ROLE_LABEL[key as Role] ||
      key,
    [roleOptions],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load users");
        return;
      }
      setError(null);
      setUsers(body.users || []);
      setRoleCounts(body.roleCounts || {});
    } catch {
      setError("Network error — could not load users");
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/roles");
        const body = await res.json();
        if (res.ok) {
          setRoleOptions(
            (body.roles || []).map(
              (r: { key: string; label: string; isSystem: boolean }) => ({
                key: r.key,
                label: r.label,
                isSystem: r.isSystem,
              }),
            ),
          );
        }
      } catch {
        /* fall back to built-in roles below */
      }
    })();
  }, []);

  const options: RoleOption[] = roleOptions.length
    ? roleOptions
    : ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r], isSystem: true }));

  async function changeRole(user: AdminUser, roleKey: string) {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not update role", "error");
        return;
      }
      pushToast(`${user.email} is now ${labelForKey(roleKey)}`, "success");
      await load();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setBusyId(null);
    }
  }

  const totalUsers = useMemo(
    () => Object.values(roleCounts).reduce((a, b) => a + b, 0),
    [roleCounts],
  );

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

      <h1 className="font-display text-3xl font-semibold text-lake">Users</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {totalUsers} account{totalUsers === 1 ? "" : "s"} in the system. Assign
        roles, edit details or reset a password. Manage what each role can do in{" "}
        <Link href="/admin/roles" className="text-lake underline">
          Roles
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRoleFilter("")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            roleFilter === ""
              ? "border-lake bg-lake text-sand"
              : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          All ({totalUsers})
        </button>
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              roleFilter === r
                ? "border-lake bg-lake text-sand"
                : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {ROLE_LABEL[r]} ({roleCounts[r] || 0})
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email or phone…"
        className="mt-4 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm"
      />

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading users…</p>
      ) : users.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-white/40 px-4 py-10 text-center text-sm text-ink-muted">
          No users match your filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line bg-white/70">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name || "—"}</p>
                    <p className="text-xs text-ink-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {u._count.bookings}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={effectiveKey(u)}
                      disabled={busyId === u.id}
                      onChange={(e) => void changeRole(u, e.target.value)}
                      className="rounded-md border border-line px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {options.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                          {o.isSystem ? "" : " (custom)"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/logs?actorId=${u.id}&actor=${encodeURIComponent(u.email)}`}
                        className="rounded-md border border-line px-3 py-1 text-sm transition hover:border-lake-bright"
                      >
                        Activity
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        className="rounded-md border border-line px-3 py-1 text-sm transition hover:border-lake-bright"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            pushToast(message, "success");
            void load();
          }}
          onError={(message) => pushToast(message, "error")}
        />
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={<p className="px-4 py-10 text-sm text-ink-muted sm:px-8">Loading users…</p>}
    >
      <AdminUsersInner />
    </Suspense>
  );
}

function EditUserDialog({
  user,
  options,
  onClose,
  onSaved,
  onError,
}: {
  user: AdminUser;
  options: RoleOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [roleKey, setRoleKey] = useState<string>(effectiveKey(user));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name, email, phone, roleKey };
      if (password.trim()) payload.password = password.trim();

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(body.error || "Could not save changes");
        return;
      }
      onSaved(
        body.unchanged ? "No changes to save" : `Saved changes for ${email}`,
      );
    } catch {
      onError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-xl font-semibold text-lake">
            Edit user
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-ink-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Role</span>
            <select
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                  {o.isSystem ? "" : " (custom)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">New password</span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Minimum 6 characters. The user should change it after signing in.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-lake px-4 py-2 text-sm text-sand disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
