import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId, slugify } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const { data: packages, error } = await db
      .from("TravelPackage")
      .select("*, items:PackageItem(*)")
      .eq("isPublished", true)
      .order("createdAt", { ascending: false });
    if (error) throw error;
    return jsonOk({ packages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }
    const body = z
      .object({
        title: z.string().min(3),
        description: z.string().optional(),
        price: z.number().int().min(0),
        days: z.number().int().min(1).default(1),
        imageUrl: z.string().optional(),
        items: z.array(z.object({ label: z.string(), details: z.string().optional() })).optional(),
      })
      .parse(await request.json());

    const packageId = createId();
    const { data: pkgRow, error: pkgError } = await db
      .from("TravelPackage")
      .insert({
        id: packageId,
        title: body.title,
        slug: `${slugify(body.title)}-${createId().slice(0, 5)}`,
        description: body.description ?? null,
        price: body.price,
        days: body.days,
        imageUrl: body.imageUrl ?? null,
        isPublished: true,
      })
      .select("*")
      .single();
    if (pkgError) throw pkgError;

    const itemRows = (body.items || []).map((item) => ({
      id: createId(),
      packageId,
      label: item.label,
      details: item.details ?? null,
    }));
    if (itemRows.length) {
      const { error: itemsError } = await db.from("PackageItem").insert(itemRows);
      if (itemsError) throw itemsError;
    }
    const pkg = { ...pkgRow, items: itemRows };
    await logAudit({
      actor: session.user,
      action: "package.create",
      entityType: "TravelPackage",
      entityId: pkg.id,
      summary: `Created package "${pkg.title}" (KES ${pkg.price.toLocaleString()})`,
    });

    return jsonOk({ package: pkg }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
