"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "image"
  | "secret";

type SettingField = {
  key: string;
  label: string;
  help?: string;
  type: FieldType;
  default: string | number | boolean;
  options?: { value: string; label: string }[];
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
};

type SettingsGroup = {
  id: string;
  label: string;
  description?: string;
  fields: SettingField[];
};

type Values = Record<string, string | number | boolean>;
type Toast = { id: number; message: string; tone: "success" | "error" };

export default function AdminSettingsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<SettingsGroup[]>([]);
  const [values, setValues] = useState<Values>({});
  const [secretsSet, setSecretsSet] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string>("general");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load settings");
        return;
      }
      setError(null);
      setGroups(body.groups || []);
      setValues(body.values || {});
      setSecretsSet(body.secretsSet || {});
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField(key: string, value: string | number | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty((d) => new Set(d).add(key));
  }

  const group = groups.find((g) => g.id === active);

  async function save() {
    if (!group) return;
    const patch: Values = {};
    for (const f of group.fields) patch[f.key] = values[f.key];
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: patch }),
      });
      const body = await res.json();
      if (!res.ok) {
        pushToast(body.error || "Could not save", "error");
        return;
      }
      setValues(body.values || values);
      if (body.secretsSet) setSecretsSet(body.secretsSet);
      setDirty((d) => {
        const next = new Set(d);
        for (const f of group.fields) next.delete(f.key);
        return next;
      });
      pushToast(`${group.label} saved`, "success");
      // Re-render server components (site header, sidebars) so changes like
      // the logo, brand name and feature flags apply right away.
      router.refresh();
    } catch {
      pushToast("Network error — please try again", "error");
    } finally {
      setSaving(false);
    }
  }

  const groupDirty = group?.fields.some((f) => dirty.has(f.key)) ?? false;

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
        <h1 className="font-display text-3xl font-semibold text-lake">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Platform-wide configuration. Changes are saved to the database.
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
        <p className="mt-6 text-sm text-ink-muted">Loading settings…</p>
      )}

      {loaded && !error && group && (
        <div className="mt-6 grid gap-6 md:grid-cols-[13rem_1fr]">
          {/* Section tabs */}
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {groups.map((g) => {
              const isActive = g.id === active;
              const hasDirty = g.fields.some((f) => dirty.has(f.key));
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActive(g.id)}
                  className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-lake text-sand shadow-sm"
                      : "text-ink-muted hover:bg-sand hover:text-ink"
                  }`}
                >
                  {g.label}
                  {hasDirty && (
                    <span className="size-1.5 rounded-full bg-sun" aria-label="unsaved" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active section */}
          <div className="rounded-xl border border-line bg-white/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  {group.label}
                </h2>
                {group.description && (
                  <p className="mt-1 text-sm text-ink-muted">{group.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !groupDirty}
                className="rounded-lg bg-lake px-4 py-2 text-sm font-medium text-sand transition hover:bg-lake-bright disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {group.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  secretSaved={secretsSet[field.key]}
                  onChange={(v) => setField(field.key, v)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  field,
  value,
  secretSaved,
  onChange,
}: {
  field: SettingField;
  value: string | number | boolean;
  secretSaved?: boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  if (field.type === "image") {
    return (
      <ImageField field={field} value={String(value ?? "")} onChange={onChange} />
    );
  }

  if (field.type === "secret") {
    return (
      <div className="border-b border-line/50 pb-4 last:border-0 last:pb-0">
        <label className="block text-sm font-medium text-ink">{field.label}</label>
        {field.help && <p className="text-xs text-ink-muted">{field.help}</p>}
        <input
          type="password"
          value={String(value ?? "")}
          autoComplete="off"
          placeholder={secretSaved ? "•••••••• (saved)" : "Not set"}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
        />
        {secretSaved && (
          <p className="mt-1 text-xs text-ink-muted">
            A value is saved. Leave blank to keep it, or type a new one to replace.
          </p>
        )}
      </div>
    );
  }

  if (field.type === "boolean") {
    const on = Boolean(value);
    return (
      <div className="flex items-center justify-between gap-4 border-b border-line/50 pb-4 last:border-0 last:pb-0">
        <div>
          <p className="text-sm font-medium text-ink">{field.label}</p>
          {field.help && <p className="text-xs text-ink-muted">{field.help}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            on ? "bg-lake" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
              on ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-line/50 pb-4 last:border-0 last:pb-0">
      <label className="block text-sm font-medium text-ink">{field.label}</label>
      {field.help && <p className="text-xs text-ink-muted">{field.help}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        {field.prefix && (
          <span className="text-sm text-ink-muted">{field.prefix}</span>
        )}
        {field.type === "textarea" ? (
          <textarea
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
          />
        ) : field.type === "select" ? (
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full max-w-xs rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
          >
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === "number" ? "number" : "text"}
            value={value === undefined || value === null ? "" : String(value)}
            min={field.min}
            max={field.max}
            onChange={(e) =>
              onChange(
                field.type === "number"
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
            className="w-full max-w-xs rounded-md border border-line px-3 py-2 text-sm focus:border-lake-bright focus:outline-none focus:ring-2 focus:ring-lake-bright/30"
          />
        )}
        {field.suffix && (
          <span className="text-sm text-ink-muted">{field.suffix}</span>
        )}
      </div>
    </div>
  );
}

function ImageField({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "branding");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          res.status === 401
            ? "Session expired — sign in again, then retry"
            : body.error || "Upload failed",
        );
        return;
      }
      onChange(body.url);
    } catch {
      setErr("Network error during upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-b border-line/50 pb-4 last:border-0 last:pb-0">
      <label className="block text-sm font-medium text-ink">{field.label}</label>
      {field.help && <p className="text-xs text-ink-muted">{field.help}</p>}
      <div className="mt-2 flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo preview" className="size-full object-contain" />
          ) : (
            <span className="text-xs text-ink-muted">None</span>
          )}
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-medium transition hover:border-lake-bright">
              {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*"
                onChange={onFile}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <p className="text-xs text-ink-muted">Max 5 MB · JPEG, PNG, WebP, GIF</p>
        </div>
      </div>
    </div>
  );
}
