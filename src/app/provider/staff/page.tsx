"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type RoleMeta = {
  key: string;
  label: string;
  summary: string;
  canManageStaff: boolean;
};

type Business = {
  id: string;
  name: string;
  slug: string;
  isApproved: boolean;
  myRole: string;
};

type Member = {
  id: string;
  role: string;
  providerId: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  provider: {
    id: string;
    name: string;
    slug: string;
    isApproved: boolean;
  } | null;
};

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<RoleMeta[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [assignable, setAssignable] = useState<Business[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [myRole, setMyRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<string[]>([]);
  const [role, setRole] = useState("FRONT_DESK");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/provider/staff");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load team");
        return;
      }
      setError(null);
      setCanManage(Boolean(data.canManage));
      setMyRole(data.myRole || "");
      setMembers(data.members || []);
      setRoles(data.roles || []);
      setBusinesses(data.businesses || []);
      const nextAssignable: Business[] =
        data.assignableBusinesses ||
        (data.businesses || []).filter((b: Business) => b.isApproved);
      setAssignable(nextAssignable);
      setSelectedBiz((prev) => {
        if (prev.length) {
          return prev.filter((id) => nextAssignable.some((b) => b.id === id));
        }
        return nextAssignable[0] ? [nextAssignable[0].id] : [];
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleMeta = useMemo(
    () => roles.find((r) => r.key === role) || null,
    [roles, role],
  );

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { user: Member["user"]; rows: Member[] }
    >();
    for (const m of members) {
      const uid = m.user?.id || m.id;
      const cur = map.get(uid) || { user: m.user, rows: [] };
      cur.rows.push(m);
      map.set(uid, cur);
    }
    return [...map.values()];
  }, [members]);

  function toggleBiz(id: string) {
    setSelectedBiz((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function registerStaff(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/provider/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        password: fd.get("password"),
        role,
        providerIds: selectedBiz,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not register staff");
      return;
    }
    setMessage(data.message || "Staff registered");
    form.reset();
    void load();
  }

  async function updateRole(memberId: string, nextRole: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/provider/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: nextRole }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update role");
      return;
    }
    setMessage("Role updated");
    void load();
  }

  async function removeMember(memberId: string, label: string) {
    if (!window.confirm(`Remove ${label} from this business?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/provider/staff?memberId=${encodeURIComponent(memberId)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not remove staff");
      return;
    }
    setMessage("Staff removed from business");
    void load();
  }

  const assignableRoles = roles.filter((r) => {
    if (r.key === "OWNER") return myRole === "OWNER";
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-lake">Staffing</h1>
      <p className="mt-2 text-ink-muted">
        Register teammates with a login, pick their role, and assign them to any
        approved business you own or manage.
      </p>

      {!loading && !canManage && (
        <p className="mt-6 rounded-xl border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-ink">
          Your role ({myRole.replace("_", " ") || "staff"}) cannot register
          staff. Ask an owner or manager / ICT.
        </p>
      )}

      {canManage && (
        <form
          onSubmit={(e) => void registerStaff(e)}
          className="provider-card mt-8 space-y-4 rounded-2xl border border-line p-5"
        >
          <h2 className="font-display text-lg font-semibold text-ink">
            Register staff
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Full name
              <input
                name="name"
                required
                minLength={2}
                placeholder="Jane Wanjiku"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Email (login)
              <input
                name="email"
                type="email"
                required
                placeholder="jane@hotel.ke"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Phone (optional)
              <input
                name="phone"
                type="tel"
                placeholder="07xx xxx xxx"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Temporary password
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Min 6 characters"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              {assignableRoles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            {roleMeta && (
              <span className="mt-1 block text-xs text-ink-muted">
                {roleMeta.summary}
              </span>
            )}
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-ink">
              Assign to businesses
            </legend>
            <p className="mt-1 text-xs text-ink-muted">
              Only approved businesses appear here. Staff can be on more than
              one.
            </p>
            {assignable.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No approved businesses yet — staffing unlocks after admin
                approval.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {assignable.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line/80 bg-white/60 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBiz.includes(b.id)}
                        onChange={() => toggleBiz(b.id)}
                        className="accent-lake"
                      />
                      <span className="font-medium text-ink">{b.name}</span>
                      <span className="text-ink-muted">
                        · you are {b.myRole.replace("_", " ")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {businesses.some((b) => !b.isApproved) && (
              <p className="mt-2 text-xs text-ink-muted">
                Pending businesses are hidden until approved.
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={busy || selectedBiz.length === 0}
            className="rounded-lg bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {busy ? "Saving…" : "Register & assign"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-4 text-sm text-lake-bright">{message}</p>}

      {roles.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">What roles can do</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {roles.map((r) => (
              <li
                key={r.key}
                className="rounded-xl border border-line/70 bg-white/50 px-3 py-2.5 text-sm"
              >
                <p className="font-semibold text-ink">{r.label}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{r.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-ink-muted">Loading team…</p>
      ) : (
        <>
          <h2 className="font-display mt-10 text-xl font-semibold">Team</h2>
          <ul className="mt-3 space-y-4">
            {grouped.map(({ user, rows }) => (
              <li
                key={user?.id || rows[0]?.id}
                className="rounded-xl border border-line bg-white/70 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {user?.name || "Staff"}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {user?.email}
                      {user?.phone ? ` · ${user.phone}` : ""}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {rows.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-sand/30 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 font-medium text-ink">
                        {m.provider?.name || "Business"}
                      </span>
                      {canManage ? (
                        <>
                          <select
                            value={m.role}
                            disabled={busy}
                            onChange={(e) =>
                              void updateRole(m.id, e.target.value)
                            }
                            className="rounded-md border border-line bg-white px-2 py-1 text-xs"
                          >
                            {assignableRoles.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.label}
                              </option>
                            ))}
                            {!assignableRoles.some((r) => r.key === m.role) && (
                              <option value={m.role}>{m.role}</option>
                            )}
                          </select>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void removeMember(
                                m.id,
                                `${user?.name || user?.email || "staff"} from ${m.provider?.name || "business"}`,
                              )
                            }
                            className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="rounded bg-lake/10 px-2 py-0.5 text-xs font-semibold text-lake">
                          {m.role.replace("_", " ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {grouped.length === 0 && (
              <li className="py-4 text-sm text-ink-muted">
                No staff yet. Register your first front desk or accountant above.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
