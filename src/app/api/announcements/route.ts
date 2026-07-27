import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { handleRouteError, jsonOk } from "@/lib/http";

// Returns active announcements targeted at the signed-in user's role.
export async function GET() {
  try {
    const session = await auth();
    const role = session?.user?.role;

    const audiences: ("ALL" | "TOURIST" | "PROVIDER")[] = ["ALL"];
    if (role === "TOURIST") audiences.push("TOURIST");
    if (role === "PROVIDER") audiences.push("PROVIDER");

    const { data: announcements, error } = await db
      .from("Announcement")
      .select("id, title, body, linkUrl")
      .eq("active", true)
      .in("audience", audiences)
      .order("createdAt", { ascending: false })
      .limit(5);
    if (error) throw error;
    return jsonOk({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
}
