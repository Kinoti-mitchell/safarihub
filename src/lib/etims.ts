/**
 * KRA eTIMS submission helpers.
 *
 * Modes (Admin → Settings → Compliance):
 * - manual: queue only; provider enters KRA ref when marking submitted
 * - sandbox: auto-submit with a sandbox KRA reference (no external call)
 * - live: POST signed invoice-style payload to compliance.etimsApiUrl
 */

import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import {
  boolSetting,
  getPlatformSettings,
  numberSetting,
  type SettingValue,
} from "@/lib/settings";

export type EtimsMode = "manual" | "sandbox" | "live";

export type EtimsSubmissionRow = {
  id: string;
  providerId: string;
  bookingId: string | null;
  packageBookingId?: string | null;
  receiptNumber: string | null;
  amount: number;
  vatAmount: number;
  status: string;
  kraRef?: string | null;
  errorMessage?: string | null;
  retryCount?: number;
  idempotencyKey?: string | null;
  nextRetryAt?: string | null;
  rawRequest?: unknown;
  rawResponse?: unknown;
};

type SettingsMap = Record<string, SettingValue>;

export function resolveEtimsMode(settings: SettingsMap): EtimsMode {
  const mode = String(settings["compliance.etimsMode"] || "manual");
  if (mode === "sandbox" || mode === "live") return mode;
  return "manual";
}

type SubmitResult =
  | { ok: true; kraRef: string; status: "SUBMITTED"; rawResponse?: unknown }
  | {
      ok: false;
      error: string;
      status: "FAILED" | "QUEUED";
      rawResponse?: unknown;
      retryable?: boolean;
    };

function buildLivePayload(row: EtimsSubmissionRow, settings: SettingsMap) {
  const tin = String(settings["compliance.etimsSellerTin"] || "").trim();
  const branch = String(settings["compliance.etimsBranch"] || "00").trim() || "00";
  return {
    // Invoice-style envelope for middleware / KRA adapters
    schemaVersion: "safarihub.etims.v1",
    idempotencyKey: row.idempotencyKey || row.id,
    seller: {
      tin: tin || undefined,
      branch,
      providerId: row.providerId,
    },
    invoice: {
      receiptNumber: row.receiptNumber,
      bookingId: row.bookingId,
      packageBookingId: row.packageBookingId ?? null,
      issuedAt: new Date().toISOString(),
      currency: "KES",
      grossAmount: row.amount,
      vatAmount: row.vatAmount,
      netAmount: Math.max(0, Number(row.amount) - Number(row.vatAmount || 0)),
      itemName: "Hospitality / travel service",
      quantity: 1,
    },
  };
}

async function submitLive(
  row: EtimsSubmissionRow,
  settings: SettingsMap,
): Promise<SubmitResult> {
  const apiUrl = String(settings["compliance.etimsApiUrl"] || "").trim();
  const apiKey = String(settings["compliance.etimsApiKey"] || "").trim();
  if (!apiUrl || !apiKey) {
    return {
      ok: false,
      status: "QUEUED",
      retryable: true,
      error:
        "Live eTIMS needs compliance.etimsApiUrl and compliance.etimsApiKey in Admin → Settings.",
    };
  }

  const payload = buildLivePayload(row, settings);
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": String(payload.idempotencyKey),
        "X-SafariHub-Receipt": String(row.receiptNumber || row.id),
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      kraRef?: string;
      reference?: string;
      invoiceNumber?: string;
      error?: string;
      message?: string;
      retryable?: boolean;
    };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status >= 500 ? "QUEUED" : "FAILED",
        retryable: res.status >= 500 || body.retryable === true,
        error:
          body.error ||
          body.message ||
          `eTIMS API returned ${res.status}`,
        rawResponse: body,
      };
    }
    const kraRef =
      String(body.kraRef || body.reference || body.invoiceNumber || "").trim() ||
      `KRA-${createId().slice(0, 12).toUpperCase()}`;
    return { ok: true, kraRef, status: "SUBMITTED", rawResponse: body };
  } catch (error) {
    return {
      ok: false,
      status: "QUEUED",
      retryable: true,
      error:
        error instanceof Error ? error.message : "eTIMS API request failed",
    };
  }
}

function submitSandbox(row: EtimsSubmissionRow): SubmitResult {
  const suffix = (row.receiptNumber || row.id).replace(/\W/g, "").slice(-8);
  return {
    ok: true,
    kraRef: `SAND-KRA-${suffix.toUpperCase()}`,
    status: "SUBMITTED",
  };
}

/** Apply a submit result to the EtimsSubmission row. */
export async function applyEtimsSubmitResult(
  id: string,
  result: SubmitResult,
  extras?: { rawRequest?: unknown; retryCount?: number },
): Promise<EtimsSubmissionRow | null> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updatedAt: now,
    status: result.status,
    lastAttemptAt: now,
    rawResponse: result.rawResponse ?? null,
  };
  if (extras?.rawRequest) patch.rawRequest = extras.rawRequest;
  if (extras?.retryCount != null) patch.retryCount = extras.retryCount;

  if (result.ok) {
    patch.kraRef = result.kraRef;
    patch.submittedAt = now;
    patch.errorMessage = null;
    patch.nextRetryAt = null;
  } else {
    patch.errorMessage = result.error.slice(0, 500);
    if (result.status === "FAILED") {
      patch.submittedAt = null;
      patch.nextRetryAt = null;
    } else if (result.retryable !== false) {
      const retries = (extras?.retryCount ?? 0) + 1;
      const backoffMin = Math.min(360, 15 * Math.pow(2, Math.min(retries, 5)));
      patch.retryCount = retries;
      patch.nextRetryAt = new Date(Date.now() + backoffMin * 60_000).toISOString();
      patch.status = "QUEUED";
    }
  }
  const { data, error } = await db
    .from("EtimsSubmission")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as EtimsSubmissionRow | null;
}

/**
 * Submit one queued row according to platform mode.
 * Manual mode leaves the row QUEUED (operator marks submitted in UI).
 */
export async function processEtimsSubmission(
  row: EtimsSubmissionRow,
  settings?: SettingsMap,
): Promise<{ submission: EtimsSubmissionRow | null; message: string }> {
  const cfg = settings ?? (await getPlatformSettings());
  const mode = resolveEtimsMode(cfg);

  if (mode === "manual") {
    return {
      submission: row,
      message: "Queued — mark submitted when you have the KRA reference.",
    };
  }

  const maxRetries = Math.max(
    1,
    numberSetting(cfg, "compliance.etimsMaxRetries") || 8,
  );
  if ((row.retryCount || 0) >= maxRetries && mode === "live") {
    const submission = await applyEtimsSubmitResult(row.id, {
      ok: false,
      status: "FAILED",
      error: `Exceeded max retries (${maxRetries})`,
    });
    return { submission, message: `Failed — exceeded ${maxRetries} retries` };
  }

  const rawRequest =
    mode === "live" ? buildLivePayload(row, cfg) : { mode: "sandbox" };
  const result =
    mode === "sandbox" ? submitSandbox(row) : await submitLive(row, cfg);
  const submission = await applyEtimsSubmitResult(row.id, result, {
    rawRequest,
    retryCount: row.retryCount || 0,
  });
  if (result.ok) {
    return {
      submission,
      message:
        mode === "sandbox"
          ? `Sandbox submitted · ${result.kraRef}`
          : `Submitted to KRA · ${result.kraRef}`,
    };
  }
  return {
    submission,
    message: result.error,
  };
}

/** Process up to `limit` QUEUED submissions (cron / batch). */
export async function processQueuedEtimsSubmissions(
  limit = 40,
): Promise<{ processed: number; submitted: number; failed: number }> {
  const settings = await getPlatformSettings();
  const mode = resolveEtimsMode(settings);
  if (mode === "manual") {
    return { processed: 0, submitted: 0, failed: 0 };
  }

  const now = new Date().toISOString();
  const { data: rows, error } = await db
    .from("EtimsSubmission")
    .select("*")
    .eq("status", "QUEUED")
    .or(`nextRetryAt.is.null,nextRetryAt.lte.${now}`)
    .order("createdAt", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let submitted = 0;
  let failed = 0;
  for (const raw of rows ?? []) {
    const row = raw as EtimsSubmissionRow;
    const { submission } = await processEtimsSubmission(row, settings);
    if (submission?.status === "SUBMITTED") submitted += 1;
    else if (submission?.status === "FAILED") failed += 1;
  }
  return { processed: (rows ?? []).length, submitted, failed };
}

/**
 * Auto-enqueue a paid booking for eTIMS when platform + provider flags allow.
 * Idempotent via idempotencyKey.
 */
export async function queueEtimsForPaidBooking(opts: {
  bookingId: string;
  providerId: string;
  receiptNumber: string | null;
  amount: number;
  vatAmount?: number;
}): Promise<{ queued: boolean; id?: string; reason?: string }> {
  const settings = await getPlatformSettings();
  if (!boolSetting(settings, "compliance.etimsEnabled")) {
    return { queued: false, reason: "etims disabled" };
  }
  if (!boolSetting(settings, "compliance.etimsAutoQueueOnPaid")) {
    return { queued: false, reason: "auto-queue off" };
  }

  const { data: provider } = await db
    .from("Provider")
    .select("etimsEnabled, kraPin")
    .eq("id", opts.providerId)
    .maybeSingle();
  if (!provider?.etimsEnabled) {
    return { queued: false, reason: "provider etims off" };
  }

  const idempotencyKey = `booking:${opts.bookingId}`;
  const { data: existing } = await db
    .from("EtimsSubmission")
    .select("id")
    .eq("idempotencyKey", idempotencyKey)
    .maybeSingle();
  if (existing) return { queued: false, id: existing.id as string, reason: "exists" };

  const vatRate = numberSetting(settings, "fees.vatRate") || 16;
  const vatAmount =
    opts.vatAmount ??
    Math.round((opts.amount * vatRate) / (100 + vatRate));

  const id = createId();
  const now = new Date().toISOString();
  const row = {
    id,
    providerId: opts.providerId,
    bookingId: opts.bookingId,
    receiptNumber: opts.receiptNumber,
    amount: opts.amount,
    vatAmount,
    status: "QUEUED",
    idempotencyKey,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const { error } = await db.from("EtimsSubmission").insert(row);
  if (error) {
    if (error.code === "23505") {
      return { queued: false, reason: "duplicate" };
    }
    console.error("queueEtimsForPaidBooking", error);
    return { queued: false, reason: error.message };
  }

  const mode = resolveEtimsMode(settings);
  if (mode !== "manual") {
    await processEtimsSubmission(
      { ...row, kraRef: null } as EtimsSubmissionRow,
      settings,
    );
  }
  return { queued: true, id };
}
