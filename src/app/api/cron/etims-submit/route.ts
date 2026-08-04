import { authorizeCron } from "@/lib/cron-auth";
import { processQueuedEtimsSubmissions } from "@/lib/etims";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

/**
 * Drain the eTIMS queue for sandbox/live modes.
 * Vercel Cron: daily on Hobby (see vercel.json).
 */
export async function GET(request: Request) {
  try {
    if (!authorizeCron(request)) return jsonError("Unauthorized", 401);
    const result = await processQueuedEtimsSubmissions(50);
    return jsonOk({
      ok: true,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
