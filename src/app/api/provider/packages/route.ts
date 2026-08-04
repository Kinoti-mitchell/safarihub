import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId, slugify } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireProviderAccess, assertProviderApproved } from "@/lib/provider";
import { logAudit } from "@/lib/audit";
import { parseBulletList } from "@/lib/tour-listing";

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(8000).optional().nullable(),
  price: z.number().int().min(0),
  days: z.number().int().min(1).max(90).default(1),
  imageUrl: z.string().max(2000).optional().nullable(),
  capacity: z.number().int().min(1).max(500).optional().nullable(),
  meetingPoint: z.string().max(400).optional().nullable(),
  inclusions: z.union([z.array(z.string()), z.string()]).optional(),
  exclusions: z.union([z.array(z.string()), z.string()]).optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        details: z.string().max(2000).optional().nullable(),
      }),
    )
    .optional(),
  isPublished: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);

    const { data: packages, error } = await db
      .from("TravelPackage")
      .select("*, items:PackageItem(*)")
      .eq("providerId", access.provider.id)
      .order("createdAt", { ascending: false });
    if (error) throw error;

    const ids = (packages ?? []).map((p: { id: string }) => p.id);
    let bookings: unknown[] = [];
    if (ids.length) {
      const { data: bookingRows, error: bookingError } = await db
        .from("PackageBooking")
        .select(
          "id, reference, packageId, startDate, guests, status, paymentStatus, totalAmount, guestName, guestEmail, guestPhone, createdAt, traveler:User(name, email, phone)",
        )
        .in("packageId", ids)
        .order("createdAt", { ascending: false })
        .limit(50);
      if (bookingError) throw bookingError;
      bookings = bookingRows ?? [];
    }

    return jsonOk({ packages: packages ?? [], bookings });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    try {
      assertProviderApproved(access);
    } catch (e) {
      return handleRouteError(e);
    }

    const body = createSchema.parse(await request.json());
    const packageId = createId();
    const inclusions = parseBulletList(body.inclusions);
    const exclusions = parseBulletList(body.exclusions);

    const { data: pkgRow, error: pkgError } = await db
      .from("TravelPackage")
      .insert({
        id: packageId,
        providerId: access.provider.id,
        title: body.title.trim(),
        slug: `${slugify(body.title)}-${createId().slice(0, 5)}`,
        description: body.description?.trim() || null,
        price: body.price,
        days: body.days,
        imageUrl: body.imageUrl?.trim() || null,
        capacity: body.capacity ?? null,
        meetingPoint: body.meetingPoint?.trim() || null,
        inclusions,
        exclusions,
        isPublished: body.isPublished ?? false,
      })
      .select("*")
      .single();
    if (pkgError) throw pkgError;

    const itemRows = (body.items || []).map((item) => ({
      id: createId(),
      packageId,
      label: item.label.trim(),
      details: item.details?.trim() || null,
    }));
    if (itemRows.length) {
      const { error: itemsError } = await db
        .from("PackageItem")
        .insert(itemRows);
      if (itemsError) throw itemsError;
    }

    const pkg = { ...pkgRow, items: itemRows };
    await logAudit({
      actor: session.user,
      action: "package.create",
      entityType: "TravelPackage",
      entityId: pkg.id,
      summary: `Provider created package "${pkg.title}" (KES ${pkg.price.toLocaleString()})`,
    });

    return jsonOk({ package: pkg }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
