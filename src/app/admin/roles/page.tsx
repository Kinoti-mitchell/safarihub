"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type BaseRole = "ADMIN" | "PROVIDER" | "TOURIST";

type RoleView = {
  key: string;
  label: string;
  description: string | null;
  baseRole: BaseRole;
  isSystem: boolean;
  permissions: string[];
};

type CatalogGroup = {
  group: string;
  items: { key: string; label: string }[];
};

type Toast = { id: number; message: string; tone: "success" | "error" };

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [catalog, setCatalog] = useState<CatalogGroup[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [creating, setCreating] = useState(false);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const setActionBusy = useCallback((key: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/roles");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load roles");
        return;
      }
      setError(null);
      setRoles(body.roles || []);
      setCatalog(body.catalog || []);
      setCounts(body.userCounts || {});
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistPermissions(role: RoleView, permissions: string[]) {
    const key = `perm:${role.key}`;
    setActionBusy(key, true);
    // Optimistic update
    setRoles((prev) =>
      prev.map((r) => (r.key === role.key ? { ...r, permissions } : r)),
    );
    try {
      const res = await fetch(`/api/admin/roles/${role.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast(body.error || "Could not save", "error");
        await load();
      }
    } catch {
      pushToast("Network error — reverting", "error");
      await load();
    } finally {
      setActionBusy(key, false);
    }
  }

  function togglePermission(role: RoleView, permKey: string) {
    if (role.key === "ADMIN") return;
    const has = role.permissions.includes(permKey);
    const next = has
      ? role.permissions.filter((p) => p !== permKey)
      : [...role.permissions, permKey];
    void persistPermissions(role, next);
  }

  async function deleteRole(role: RoleView) {
    if (!confirm(`Delete the "${role.label}" role?`)) return;
    const key = `del:${role.key}`;
    setActionBusy(key, true);
    try {
      const res = await fetch(`/api/admin/roles/${role.key}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(body.error || "Could not delete", "error");
        return;
      }
      pushToast(`Deleted "${role.label}"`, "success");
      await load();
    } finally {
      setActionBusy(key, false);
    }
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake">
            Roles &amp; permissions
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Toggle what each role can do — changes save to the database
            instantly. The built-in Admin role always has every permission and
            cannot be reduced. To assign a role to someone, use{" "}
            <Link href="/admin/users" className="text-lake underline">
              Users
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg bg-lake px-4 py-2 text-sm font-medium text-sand transition hover:bg-lake-bright"
        >
          + New role
        </button>
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
        <p className="mt-6 text-sm text-ink-muted">Loading roles…</p>
      )}

      {loaded && !error && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white/70">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 z-10 bg-white/90 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Permission
                </th>
                {roles.map((role) => (
                  <th key={role.key} className="min-w-[9rem] px-3 py-3 align-top">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="font-display text-sm font-semibold text-ink">
                        {role.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="rounded-full bg-lake/10 px-2 py-0.5 text-[0.65rem] font-medium text-lake">
                          {counts[role.key] || 0} user
                          {(counts[role.key] || 0) === 1 ? "" : "s"}
                        </span>
                        {role.isSystem ? (
                          <span className="rounded-full bg-line/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-ink-muted">
                            {role.key === "ADMIN" ? "full access" : "system"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-sun/20 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-ink">
                            {role.baseRole.toLowerCase()}
                          </span>
                        )}
                      </span>
                      {!role.isSystem && (
                        <button
                          type="button"
                          disabled={busy.has(`del:${role.key}`)}
                          onClick={() => void deleteRole(role)}
                          className="text-[0.65rem] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          delete
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.map((group) => (
                <GroupRows
                  key={group.group}
                  group={group}
                  roles={roles}
                  busy={busy}
                  onToggle={togglePermission}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateRoleDialog
          catalog={catalog}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            pushToast("Role created", "success");
            void load();
          }}
          onError={(m) => pushToast(m, "error")}
        />
      )}
    </div>
  );
}

function GroupRows({
  group,
  roles,
  busy,
  onToggle,
}: {
  group: CatalogGroup;
  roles: RoleView[];
  busy: Set<string>;
  onToggle: (role: RoleView, permKey: string) => void;
}) {
  return (
    <>
      <tr className="bg-sand/40">
        <td
          colSpan={roles.length + 1}
          className="sticky left-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted"
        >
          {group.group}
        </td>
      </tr>
      {group.items.map((item) => (
        <tr key={item.key} className="border-b border-line/50 last:border-0">
          <td className="sticky left-0 z-10 bg-white/90 px-4 py-2.5">
            <span className="font-medium text-ink">{item.label}</span>
            <span className="ml-2 font-mono text-[0.65rem] text-ink-muted">
              {item.key}
            </span>
          </td>
          {roles.map((role) => {
            const checked =
              role.key === "ADMIN" || role.permissions.includes(item.key);
            const locked = role.key === "ADMIN";
            const isBusy = busy.has(`perm:${role.key}`);
            return (
              <td key={role.key} className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isBusy || locked}
                  onChange={() => onToggle(role, item.key)}
                  className="size-4 cursor-pointer accent-lake disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${role.label}: ${item.label}${locked ? " (locked)" : ""}`}
                  title={locked ? "Admin always has full access" : undefined}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function CreateRoleDialog({
  catalog,
  onClose,
  onCreated,
  onError,
}: {
  catalog: CatalogGroup[];
  onClose: () => void;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState<BaseRole>("TOURIST");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description: description || undefined,
          baseRole,
          permissions,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(body.error || "Could not create role");
        return;
      }
      onCreated();
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
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-xl font-semibold text-lake">
            New role
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
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              minLength={2}
              maxLength={40}
              placeholder="e.g. Content editor"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Based on area</span>
            <select
              value={baseRole}
              onChange={(e) => setBaseRole(e.target.value as BaseRole)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              <option value="ADMIN">Admin console</option>
              <option value="PROVIDER">Provider workspace</option>
              <option value="TOURIST">Traveller account</option>
            </select>
            <span className="mt-1 block text-xs text-ink-muted">
              Determines which dashboard users with this role land on.
            </span>
          </label>

          <div>
            <p className="text-sm text-ink-muted">Permissions</p>
            <div className="mt-2 space-y-3">
              {catalog.map((group) => (
                <div key={group.group}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {group.group}
                  </p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(item.key)}
                          onChange={() => toggle(item.key)}
                          className="size-4 accent-lake"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
              {saving ? "Creating…" : "Create role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
