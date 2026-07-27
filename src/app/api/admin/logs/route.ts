import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { listAuditLogs } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("logs.view");
    const { searchParams } = new URL(request.url);
    const logs = await listAuditLogs({
      entityType: searchParams.get("entityType") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      query: searchParams.get("q")?.trim() || undefined,
      limit: Number(searchParams.get("limit")) || 100,
    });
    return jsonOk({ logs });
  } catch (error) {
    return handleRouteError(error);
  }
}
