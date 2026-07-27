import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId, slugify } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { LISTING_CATEGORY_KEYS } from "@/lib/amenities";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

/** Active labels for providers; ?category=EAT filters; ?all=true for admin. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.toUpperCase() || undefined;
    const all = searchParams.get("all") === "true";

    let query = db
      .from("CategoryLabel")
      .select("*")
      .order("category", { ascending: true })
      .order("sortOrder", { ascending: true })
      .order("name", { ascending: true });

    if (!all) query = query.eq("isActive", true);
    if (category) {
      // Include shared ALL amenities plus the specific category
      query = query.in("category", [category, "ALL"]);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01" || error.message?.includes("CategoryLabel")) {
        return jsonOk({
          labels: [],
          setupRequired: true,
          message: "Run db/2026-category-labels.sql in Supabase.",
        });
      }
      throw error;
    }

    return jsonOk({ labels: data ?? [], setupRequired: false });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  category: z.enum(["STAY", "EAT", "MOVE", "EXPLORE", "MEET", "ALL"]),
  name: z.string().min(2).max(60),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid label data");

    const name = parsed.data.name.trim();
    const now = new Date().toISOString();
    const row = {
      id: createId("cl"),
      category: parsed.data.category,
      name,
      slug: `${slugify(name) || "label"}-${createId().slice(-4)}`,
      sortOrder: parsed.data.sortOrder ?? 100,
      isActive: parsed.data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const { data, error } = await db
      .from("CategoryLabel")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ label: data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return jsonError("id required");

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name != null) {
      patch.name = String(body.name).trim();
      patch.slug = slugify(String(body.name)) || "label";
    }
    if (body.category != null) {
      const cat = String(body.category).toUpperCase();
      const allowed = [...LISTING_CATEGORY_KEYS, "ALL"];
      if (!allowed.includes(cat)) {
        return jsonError("Invalid category");
      }
      patch.category = cat;
    }
    if (body.sortOrder != null) patch.sortOrder = Number(body.sortOrder) || 0;
    if (body.isActive != null) patch.isActive = Boolean(body.isActive);

    const { data, error } = await db
      .from("CategoryLabel")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return jsonOk({ label: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("id required");
    const { error } = await db.from("CategoryLabel").delete().eq("id", id);
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
