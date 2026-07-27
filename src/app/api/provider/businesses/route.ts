import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { z } from "zod";
import { createId, slugify } from "@/lib/ids";
import {
  listProvidersForUser,
  requireProviderAccess,
  setActiveProviderCookie,
  userCanAccessProvider,
} from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import {
  getPlatformSettings,
  numberSetting,
} from "@/lib/settings";
import {
  findIdentityClash,
  normalizeIdNumber,
  normalizeRegistrationNumber,
  validateKenyanPhone,
} from "@/lib/identity";
import { uploadKycDocument } from "@/lib/uploads";
import {
  providerVerificationFields,
  refineProviderVerification,
  verificationInsertFromParsed,
} from "@/lib/provider-verification";
import { resolveHardGateAutoApproval } from "@/lib/provider-auto-approval";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const memberships = await listProvidersForUser(session.user.id);
    const active = await requireProviderAccess(session.user.id).catch(
      () => null,
    );

    return jsonOk({
      businesses: memberships.map((m) => ({
        id: m.provider.id,
        name: m.provider.name,
        slug: m.provider.slug,
        isApproved: Boolean(m.provider.isApproved),
        role: m.role,
      })),
      activeProviderId: active?.provider.id ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z
  .object({
    name: z.string().min(2),
    phone: z.string().optional(),
    kycType: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
    idNumber: z.string().optional(),
    registrationNumber: z.string().optional(),
    ...providerVerificationFields,
  })
  .superRefine((data, ctx) => {
    const type = data.kycType ?? "INDIVIDUAL";
    if (type === "INDIVIDUAL" && !data.idNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idNumber"],
        message: "National ID number is required for individual businesses",
      });
    }
    if (type === "COMPANY" && !data.registrationNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationNumber"],
        message: "Company registration number is required",
      });
    }
    refineProviderVerification(
      {
        kycType: type,
        kraPin: data.kraPin,
        companyEmail: data.companyEmail,
        postalAddress: data.postalAddress,
        countyId: data.countyId,
        townId: data.townId,
        businessType: data.businessType,
        operatingDays: data.operatingDays,
        opensAt: data.opensAt,
        closesAt: data.closesAt,
        establishedDate: data.establishedDate,
        latitude: data.latitude,
        longitude: data.longitude,
        website: data.website,
        registrantRole: data.registrantRole,
        ownerIdDocUrl: data.ownerIdDocUrl,
        kraPinDocUrl: data.kraPinDocUrl,
        registrationCertUrl: data.registrationCertUrl,
        businessPermitUrl: data.businessPermitUrl,
        kycDocUrl: data.kycDocUrl,
      },
      ctx,
      { requireDocs: true },
    );
  });

function formStr(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function formNum(form: FormData, key: string): number | null {
  const raw = formStr(form, key).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formFile(form: FormData, key: string): File | null {
  const v = form.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}

async function uploadIfPresent(
  file: File | null,
  ownerId: string,
  kind: string,
): Promise<string | null> {
  if (!file) return null;
  const uploaded = await uploadKycDocument({
    ownerId,
    file,
    fileName: file.name || `${kind}.pdf`,
    contentType: file.type || "application/octet-stream",
    kind,
  });
  return uploaded.publicUrl;
}

/** Create an additional business under the same user account. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const contentType = request.headers.get("content-type") || "";
    let raw: Record<string, unknown>;
    const files = {
      ownerIdDoc: null as File | null,
      kraPinDoc: null as File | null,
      registrationCert: null as File | null,
      businessPermit: null as File | null,
      kycDoc: null as File | null,
      otherDocs: [] as File[],
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      raw = {
        name: formStr(form, "name"),
        phone: formStr(form, "phone") || undefined,
        kycType: formStr(form, "kycType") || "INDIVIDUAL",
        idNumber: formStr(form, "idNumber") || undefined,
        registrationNumber: formStr(form, "registrationNumber") || undefined,
        companyEmail: formStr(form, "companyEmail") || undefined,
        kraPin: formStr(form, "kraPin") || undefined,
        postalAddress: formStr(form, "postalAddress") || undefined,
        countyId: formStr(form, "countyId") || undefined,
        townId: formStr(form, "townId") || undefined,
        businessType: formStr(form, "businessType") || undefined,
        operatingDays: formStr(form, "operatingDays") || undefined,
        opensAt: formStr(form, "opensAt") || undefined,
        closesAt: formStr(form, "closesAt") || undefined,
        establishedDate: formStr(form, "establishedDate") || undefined,
        latitude: formNum(form, "latitude"),
        longitude: formNum(form, "longitude"),
        website: formStr(form, "website") || undefined,
        directors: formStr(form, "directors") || "[]",
        registrantRole: formStr(form, "registrantRole") || undefined,
      };
      files.ownerIdDoc = formFile(form, "ownerIdDoc");
      files.kraPinDoc = formFile(form, "kraPinDoc");
      files.registrationCert = formFile(form, "registrationCert");
      files.businessPermit = formFile(form, "businessPermit");
      files.kycDoc = formFile(form, "kycDoc");
      files.otherDocs = form
        .getAll("otherDocs")
        .filter((v): v is File => v instanceof File && v.size > 0)
        .slice(0, 10);
      if (files.ownerIdDoc) raw.ownerIdDocUrl = "https://pending.local/owner-id";
      if (files.kraPinDoc) raw.kraPinDocUrl = "https://pending.local/kra-pin";
      if (files.registrationCert)
        raw.registrationCertUrl = "https://pending.local/reg-cert";
      if (files.businessPermit)
        raw.businessPermitUrl = "https://pending.local/permit";
      if (files.kycDoc) raw.kycDocUrl = "https://pending.local/kyc";
    } else {
      raw = await request.json();
    }

    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ||
          "Business verification details are incomplete",
        400,
      );
    }

    const settings = await getPlatformSettings();
    const name = parsed.data.name.trim();
    const phoneResult = validateKenyanPhone(parsed.data.phone);
    if (phoneResult.error) return jsonError(phoneResult.error, 400);
    const phone = phoneResult.phone;
    const kycType = parsed.data.kycType ?? "INDIVIDUAL";
    const idNumber = normalizeIdNumber(parsed.data.idNumber);
    const registrationNumber = normalizeRegistrationNumber(
      parsed.data.registrationNumber,
    );
    const now = new Date().toISOString();
    const providerId = createId();
    const slug = `${slugify(name) || "business"}-${providerId.slice(-6)}`;

    const clash = await findIdentityClash({
      phone,
      idNumber,
      registrationNumber,
      excludeUserId: session.user.id,
    });
    if (clash) return jsonError(clash.message, 409);

    let ownerIdDocUrl = parsed.data.ownerIdDocUrl?.startsWith(
      "https://pending.local/",
    )
      ? null
      : parsed.data.ownerIdDocUrl || null;
    let kraPinDocUrl = parsed.data.kraPinDocUrl?.startsWith(
      "https://pending.local/",
    )
      ? null
      : parsed.data.kraPinDocUrl || null;
    let registrationCertUrl = parsed.data.registrationCertUrl?.startsWith(
      "https://pending.local/",
    )
      ? null
      : parsed.data.registrationCertUrl || null;
    let businessPermitUrl = parsed.data.businessPermitUrl?.startsWith(
      "https://pending.local/",
    )
      ? null
      : parsed.data.businessPermitUrl || null;
    let kycDocUrl = parsed.data.kycDocUrl?.startsWith("https://pending.local/")
      ? null
      : parsed.data.kycDocUrl || null;
    const otherDocsUrls: string[] = [];

    try {
      if (files.ownerIdDoc) {
        ownerIdDocUrl = await uploadIfPresent(
          files.ownerIdDoc,
          session.user.id,
          "owner-id",
        );
      }
      if (files.kraPinDoc) {
        kraPinDocUrl = await uploadIfPresent(
          files.kraPinDoc,
          session.user.id,
          "kra-pin",
        );
      }
      if (files.registrationCert) {
        registrationCertUrl = await uploadIfPresent(
          files.registrationCert,
          session.user.id,
          "certificate-of-incorporation",
        );
      }
      if (files.businessPermit) {
        businessPermitUrl = await uploadIfPresent(
          files.businessPermit,
          session.user.id,
          "business-permit",
        );
      }
      if (files.kycDoc) {
        kycDocUrl = await uploadIfPresent(
          files.kycDoc,
          session.user.id,
          "cr12",
        );
      }
      for (let i = 0; i < files.otherDocs.length; i++) {
        const url = await uploadIfPresent(
          files.otherDocs[i],
          session.user.id,
          `other-${i + 1}`,
        );
        if (url) otherDocsUrls.push(url);
      }
    } catch (uploadErr) {
      const msg =
        uploadErr instanceof Error
          ? uploadErr.message
          : "Could not upload verification documents";
      return jsonError(msg, 400);
    }

    if (!ownerIdDocUrl) {
      return jsonError("Upload a photo/scan of the owner's national ID", 400);
    }
    if (!kraPinDocUrl) {
      return jsonError("Upload the KRA PIN document", 400);
    }
    if (!registrationCertUrl) {
      return jsonError("Upload the certificate of incorporation", 400);
    }
    if (!businessPermitUrl) {
      return jsonError("Upload the business permit / tourism licence", 400);
    }
    if (!kycDocUrl) {
      return jsonError("Upload the CR12 / supporting document", 400);
    }

    const verification = verificationInsertFromParsed({
      ...parsed.data,
      ownerIdDocUrl,
      kraPinDocUrl,
      registrationCertUrl,
      businessPermitUrl,
      kycDocUrl,
      otherDocsUrls,
    });

    const approval = await resolveHardGateAutoApproval(
      {
        kycType,
        phoneVerifiedAt: now,
        termsAcceptedAt: verification.termsAcceptedAt,
        privacyAcceptedAt: verification.privacyAcceptedAt,
        kraPin: verification.kraPin,
        mpesaTillOrPaybill: verification.mpesaTillOrPaybill,
        ownerIdDocUrl,
        selfieDocUrl: verification.selfieDocUrl,
        kraPinDocUrl,
        businessPermitUrl,
        registrationCertUrl,
        kycDocUrl,
        businessPermitExpiresAt: verification.businessPermitExpiresAt,
        amenities: verification.amenities,
        latitude: verification.latitude,
        longitude: verification.longitude,
        countyId: verification.countyId,
        townId: verification.townId,
        idNumber,
        registrationNumber,
        phone,
        email: verification.companyEmail || session.user.email,
      },
      settings,
      { excludeUserId: session.user.id, skipIdentityClash: true },
    );

    const { error: providerError } = await db.from("Provider").insert({
      id: providerId,
      name,
      slug,
      email: verification.companyEmail || session.user.email,
      phone,
      kycType,
      idNumber,
      registrationNumber,
      ...verification,
      phoneVerifiedAt: now,
      kycStatus: approval.kycStatus,
      isApproved: approval.isApproved,
      commissionRate:
        Math.round(numberSetting(settings, "fees.defaultCommission")) || 10,
      createdAt: now,
      updatedAt: now,
    });
    if (providerError) {
      if (String(providerError.message).toLowerCase().includes("unique")) {
        return jsonError(
          "That company registration or phone is already registered",
          409,
        );
      }
      if (
        /ownerIdDocUrl|registrationCertUrl|companyEmail|postalAddress|businessType/i.test(
          providerError.message,
        )
      ) {
        return jsonError(
          "Database needs db/2026-provider-verification.sql applied before creating businesses.",
          503,
        );
      }
      throw providerError;
    }

    const { error: memberError } = await db.from("ProviderMember").insert({
      id: createId("pm"),
      providerId,
      userId: session.user.id,
      role: "OWNER",
    });
    if (memberError) {
      await db.from("Provider").delete().eq("id", providerId);
      throw memberError;
    }

    await setActiveProviderCookie(providerId);

    if (approval.autoApproved) {
      try {
        await logAudit({
          actor: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
          },
          action: "provider.auto_approve",
          entityType: "Provider",
          entityId: providerId,
          summary: `Hard-gate auto-approved "${name}" on add-business`,
        });
      } catch {
        /* non-blocking */
      }
    }

    return jsonOk(
      {
        business: {
          id: providerId,
          name,
          slug,
          isApproved: approval.isApproved,
          role: "OWNER",
          autoApproved: approval.autoApproved,
        },
        message: approval.autoApproved
          ? `${name} created and auto-approved (all hard checks passed).`
          : `${name} created — awaiting admin verification before you can list.`,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Switch the active business for this session. */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const providerId = String(body.providerId || "").trim();
    if (!providerId) return jsonError("providerId required");

    const allowed = await userCanAccessProvider(session.user.id, providerId);
    if (!allowed) return jsonError("You do not manage that business", 403);

    await setActiveProviderCookie(providerId);
    return jsonOk({ activeProviderId: providerId });
  } catch (error) {
    return handleRouteError(error);
  }
}
