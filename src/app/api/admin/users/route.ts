import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { isRole } from "@/lib/roles";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("user.manage");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const roleParam = searchParams.get("role");
    const role = roleParam && isRole(roleParam) ? roleParam : undefined;

    let query = db
      .from("User")
      .select(
        "id, name, email, phone, role, roleKey, createdAt, bookings:Booking(count)",
      )
      .order("createdAt", { ascending: false })
      .limit(200);
    if (role) query = query.eq("role", role);
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        `name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
      );
    }

    const [usersRes, countRes] = await Promise.all([
      query,
      db.from("User").select("role"),
    ]);
    if (usersRes.error) throw usersRes.error;

    const users = (
      (usersRes.data ?? []) as Array<
        Record<string, unknown> & { bookings?: Array<{ count: number }> }
      >
    ).map((u) => {
      const { bookings, ...rest } = u;
      return { ...rest, _count: { bookings: bookings?.[0]?.count ?? 0 } };
    });

    const roleCounts: Record<string, number> = {};
    for (const r of (countRes.data ?? []) as Array<{ role: string }>) {
      roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1;
    }

    return jsonOk({ users, roleCounts, total: users.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
