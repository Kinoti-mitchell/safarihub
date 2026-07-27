import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";

const STATUSES = ["NEW", "REPLIED", "CLOSED"];

export async function GET(request: Request) {
  try {
    await requireAdminPermission("inquiry.manage");

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const q = searchParams.get("q")?.trim();

    let query = db
      .from("Inquiry")
      .select(
        "id, name, email, phone, message, status, reply, createdAt, listing:Listing(title), provider:Provider(name)",
      )
      .order("createdAt", { ascending: false })
      .limit(100);
    if (statusParam && STATUSES.includes(statusParam)) {
      query = query.eq("status", statusParam);
    }
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        `name.ilike.${like},email.ilike.${like},message.ilike.${like}`,
      );
    }

    const [inquiriesRes, countRes] = await Promise.all([
      query,
      db.from("Inquiry").select("status"),
    ]);
    if (inquiriesRes.error) throw inquiriesRes.error;

    const inquiries = (inquiriesRes.data ?? []) as unknown as Array<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      message: string;
      status: string;
      reply: string | null;
      createdAt: string;
      listing: { title: string } | null;
      provider: { name: string } | null;
    }>;

    const summary: Record<string, number> = { NEW: 0, REPLIED: 0, CLOSED: 0 };
    for (const c of (countRes.data ?? []) as Array<{ status: string }>) {
      summary[c.status] = (summary[c.status] ?? 0) + 1;
    }

    return jsonOk({
      inquiries: inquiries.map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        phone: i.phone,
        message: i.message,
        status: i.status,
        reply: i.reply,
        createdAt: i.createdAt,
        listing: i.listing,
        provider: i.provider,
      })),
      summary,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
