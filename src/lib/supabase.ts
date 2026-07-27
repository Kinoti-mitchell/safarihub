import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Same env shape as intern attachment system (with Next.js NEXT_PUBLIC_ aliases). */
export function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function isSupabaseConfigured() {
  const url = getSupabaseUrl();
  return Boolean(
    url &&
      !url.includes("YOUR_PROJECT") &&
      !url.includes("dashboard/project") &&
      getSupabaseAnonKey(),
  );
}

/** Browser / public client (anon key). Same pattern as intern `@/api/client`. */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase URL / anon key not configured");
  }
  return createClient(url, key);
}

/** Server client with service role — never expose to the browser. */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

/**
 * Shared server-side data client (service role). This is the TRace-style data
 * access layer — every server route/query goes through Supabase's HTTP
 * (PostgREST) API instead of a direct pooled Postgres connection, so there is
 * no connection pool to exhaust. Cached across the dev-server's hot reloads.
 */
const globalForDb = globalThis as unknown as {
  supabaseData: SupabaseClient | undefined;
};

export const db: SupabaseClient =
  globalForDb.supabaseData ?? createSupabaseAdminClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.supabaseData = db;
}

/** Throw a readable error from a PostgREST response. Mirrors intern error flow. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
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
