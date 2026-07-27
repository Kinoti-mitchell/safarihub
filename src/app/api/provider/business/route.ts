import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireProviderAccess } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { validateKenyanPhone } from "@/lib/identity";
import { normalizeAmenities } from "@/lib/amenities";

const FULL_SELECT =
  "id, name, slug, description, phone, email, logoUrl, termsAndConditions, isApproved, kycStatus, businessType, amenities, postalAddress, companyEmail, kraPin, mpesaTillOrPaybill, operatingDays, opensAt, closesAt, establishedDate, website, registrantRole, latitude, longitude, businessPermitExpiresAt, traLicenceExpiresAt, countyId, townId";
const BASIC_SELECT =
  "id, name, slug, description, phone, email, isApproved";

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "42703" ||
    Boolean(e.message?.includes("does not exist")) ||
    Boolean(e.message?.includes("logoUrl")) ||
    Boolean(e.message?.includes("termsAndConditions")) ||
    Boolean(e.message?.includes("amenities"))
  );
}

function withBrandDefaults(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...row,
    logoUrl: (row.logoUrl as string | null | undefined) ?? null,
    termsAndConditions:
      (row.termsAndConditions as string | null | undefined) ?? null,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { provider } = await requireProviderAccess(session.user.id);

    let { data, error } = await db
      .from("Provider")
      .select(FULL_SELECT)
      .eq("id", provider.id)
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      const fallback = await db
        .from("Provider")
        .select(BASIC_SELECT)
        .eq("id", provider.id)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      data = fallback.data
        ? (withBrandDefaults(fallback.data as Record<string, unknown>) as typeof data)
        : null;
      error = null;
    } else if (error) {
      throw error;
    }

    if (!data) return jsonError("Business not found", 404);

    return jsonOk({
      business: withBrandDefaults(data as Record<string, unknown>),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(4000).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  logoUrl: z.string().max(2000).optional().nullable(),
  termsAndConditions: z.string().max(20000).optional().nullable(),
  amenities: z.array(z.string()).optional(),
});

/** Update the active business profile (logo, terms, description, amenities). */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { provider } = await requireProviderAccess(session.user.id);

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError("Invalid business profile details", 400);
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) {
      patch.name = parsed.data.name.trim();
    }
    if (parsed.data.description !== undefined) {
      const d = parsed.data.description?.trim() || null;
      patch.description = d;
    }
    if (parsed.data.phone !== undefined) {
      if (parsed.data.phone === null || parsed.data.phone === "") {
        patch.phone = null;
      } else {
        const phoneResult = validateKenyanPhone(parsed.data.phone);
        if (phoneResult.error) return jsonError(phoneResult.error, 400);
        patch.phone = phoneResult.phone;
      }
    }
    if (parsed.data.logoUrl !== undefined) {
      patch.logoUrl = parsed.data.logoUrl?.trim() || null;
    }
    if (parsed.data.termsAndConditions !== undefined) {
      const terms = parsed.data.termsAndConditions?.trim() || null;
      patch.termsAndConditions = terms;
    }
    if (parsed.data.amenities !== undefined) {
      patch.amenities = normalizeAmenities(parsed.data.amenities);
    }

    const wantsBrand =
      parsed.data.logoUrl !== undefined ||
      parsed.data.termsAndConditions !== undefined;

    let { data, error } = await db
      .from("Provider")
      .update(patch)
      .eq("id", provider.id)
      .select(FULL_SELECT)
      .single();

    if (error && isMissingColumnError(error)) {
      if (wantsBrand) {
        return jsonError(
          "Logo & terms need db/2026-provider-brand.sql applied on Supabase (adds Provider.logoUrl and termsAndConditions).",
          503,
        );
      }
      if (parsed.data.amenities !== undefined) {
        return jsonError(
          "Amenities need db/2026-provider-verification-extras.sql applied on Supabase.",
          503,
        );
      }
      const basicPatch = { ...patch };
      delete basicPatch.logoUrl;
      delete basicPatch.termsAndConditions;
      delete basicPatch.amenities;
      const fallback = await db
        .from("Provider")
        .update(basicPatch)
        .eq("id", provider.id)
        .select(BASIC_SELECT)
        .single();
      if (fallback.error) throw fallback.error;
      data = withBrandDefaults(
        fallback.data as Record<string, unknown>,
      ) as typeof data;
      error = null;
    } else if (error) {
      throw error;
    }

    return jsonOk({
      business: withBrandDefaults(data as Record<string, unknown>),
      message: "Business profile saved",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
