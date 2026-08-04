import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import {
  processEtimsSubmission,
  processQueuedEtimsSubmissions,
  type EtimsSubmissionRow,
} from "@/lib/etims";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("settings.manage");
    const status = new URL(request.url).searchParams.get("status");
    let query = db
      .from("EtimsSubmission")
      .select(
        `id, providerId, bookingId, receiptNumber, amount, vatAmount, status,
         kraRef, errorMessage, retryCount, nextRetryAt, createdAt, submittedAt,
         provider:Provider(name), booking:Booking(reference)`,
      )
      .order("createdAt", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;

    const tallies = { QUEUED: 0, SUBMITTED: 0, FAILED: 0 };
    for (const row of data ?? []) {
      const s = row.status as keyof typeof tallies;
      if (s in tallies) tallies[s] += 1;
    }
    return jsonOk({ submissions: data ?? [], tallies });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminPermission("settings.manage");
    const body = (await request.json()) as {
      action?: string;
      id?: string;
    };

    if (body.action === "drain") {
      const result = await processQueuedEtimsSubmissions(40);
      return jsonOk(result);
    }

    if (body.action === "retry" && body.id) {
      const { data: row } = await db
        .from("EtimsSubmission")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (!row) return jsonError("Not found", 404);
      await db
        .from("EtimsSubmission")
        .update({
          status: "QUEUED",
          nextRetryAt: null,
          errorMessage: null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", body.id);
      const processed = await processEtimsSubmission({
        ...(row as EtimsSubmissionRow),
        status: "QUEUED",
      });
      return jsonOk(processed);
    }

    return jsonError("Unknown action", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}
