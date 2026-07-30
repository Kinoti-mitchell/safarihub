import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined): string {
  return (value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function isValidSupabaseUrl(url: string): boolean {
  if (!url || url.includes("YOUR_PROJECT") || url.includes("dashboard/project")) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Same env shape as intern attachment system (with Next.js NEXT_PUBLIC_ aliases). */
export function getSupabaseUrl() {
  return (
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    cleanEnv(process.env.SUPABASE_URL) ||
    ""
  );
}

export function getSupabaseAnonKey() {
  return (
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.VITE_SUPABASE_ANON_KEY) ||
    ""
  );
}

export function getSupabaseServiceRoleKey() {
  return cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseConfigured() {
  const url = getSupabaseUrl();
  return Boolean(isValidSupabaseUrl(url) && getSupabaseAnonKey());
}

/** Browser / public client (anon key). Same pattern as intern `@/api/client`. */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!isValidSupabaseUrl(url) || !key) {
    throw new Error("Supabase URL / anon key not configured");
  }
  return createClient(url, key);
}

/** Server client with service role — never expose to the browser. */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!isValidSupabaseUrl(url) || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

/**
 * Shared server-side data client (service role). Lazy so Next.js build-time
 * page collection does not crash when env vars are missing or incomplete.
 */
const globalForDb = globalThis as unknown as {
  supabaseData: SupabaseClient | undefined;
};

function getDb(): SupabaseClient {
  if (globalForDb.supabaseData) return globalForDb.supabaseData;

  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();

  if (isValidSupabaseUrl(url) && serviceKey) {
    globalForDb.supabaseData = createSupabaseAdminClient();
  } else {
    // Placeholder for build/import only — real requests need valid env at runtime.
    globalForDb.supabaseData = createClient(
      "https://placeholder.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  return globalForDb.supabaseData;
}

export const db: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

/** Throw a readable error from a PostgREST response. Mirrors intern error flow. */
export function unwrap<T>(res: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Listing photos bucket — mirrors intern `task-attachments` / `log-attachments`. */
export const LISTING_IMAGES_BUCKET = "listing-images";
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_LISTING_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
/** KYC / KYB docs: images + PDF (ID, certificate, permit). */
export const ALLOWED_KYC_DOC_TYPES = [
  ...ALLOWED_LISTING_IMAGE_TYPES,
  "application/pdf",
] as const;
export const MAX_KYC_DOC_BYTES = 8 * 1024 * 1024; // 8 MB
