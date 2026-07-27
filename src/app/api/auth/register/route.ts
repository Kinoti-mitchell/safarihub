import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { setActiveProviderCookie } from "@/lib/provider";
import { getPlatformSettings, boolSetting, numberSetting } from "@/lib/settings";
import type { Role } from "@/lib/roles";
import {
  findIdentityClash,
  normalizeEmail,
  normalizeIdNumber,
  normalizeRegistrationNumber,
  validateKenyanPhone,
} from "@/lib/identity";
import { uploadKycDocument } from "@/lib/uploads";
import { assertVerifiedOtp } from "@/lib/otp";
import {
  providerVerificationFields,
  refineProviderVerification,
  verificationInsertFromParsed,
} from "@/lib/provider-verification";
import { resolveHardGateAutoApproval } from "@/lib/provider-auto-approval";
import { logAudit } from "@/lib/audit";

const registerSchema = z
  .object({
    name: z.string().min(2).optional(),
    firstName: z.string().min(2).optional(),
    /** Optional middle / second given name */
    secondName: z.string().max(80).optional(),
    lastName: z.string().min(2).optional(),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().min(10, "Phone number is required"),
    role: z.enum(["TOURIST", "PROVIDER"]).default("TOURIST"),
    businessName: z.string().min(2).optional(),
    kycType: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
    idNumber: z.string().min(3).optional(),
    registrationNumber: z.string().min(3).optional(),
    amenities: z.array(z.string()).optional(),
    ...providerVerificationFields,
  })
  .superRefine((data, ctx) => {
    const first = data.firstName?.trim() || "";
    const second = data.secondName?.trim() || "";
    const last = data.lastName?.trim() || "";
    const fullName =
      data.name?.trim() ||
      [first, second, last].filter(Boolean).join(" ");
    if (!first || first.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstName"],
        message: "First name is required",
      });
    }
    if (!last || last.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastName"],
        message: "Last name is required",
      });
    }
    if (!fullName || fullName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstName"],
        message: "First and last name are required",
      });
    }
    if (
      data.role === "PROVIDER" &&
      (!data.amenities || data.amenities.length < 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amenities"],
        message: "Select at least one amenity your business offers",
      });
    }
    if (data.role !== "PROVIDER") return;
    if (!data.idNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idNumber"],
        message: "National ID number is required",
      });
    }
    const type = data.kycType ?? "INDIVIDUAL";
    if (type === "COMPANY" && !data.registrationNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationNumber"],
        message: "Company registration/certificate number is required",
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
        selfieDocUrl: data.selfieDocUrl,
        mpesaTillOrPaybill: data.mpesaTillOrPaybill,
        businessPermitExpiresAt: data.businessPermitExpiresAt,
        termsAccepted: data.termsAccepted,
        privacyAccepted: data.privacyAccepted,
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

function formAmenities(form: FormData): string[] {
  const raw = formStr(form, "amenities").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String);
  } catch {
    return form
      .getAll("amenities")
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
}

async function parseRegisterBody(request: Request): Promise<{
  data: Record<string, unknown>;
  files: {
    ownerIdDoc: File | null;
    kraPinDoc: File | null;
    registrationCert: File | null;
    businessPermit: File | null;
    kycDoc: File | null;
    selfieDoc: File | null;
    otherDocs: File[];
  };
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const otherDocs = form
      .getAll("otherDocs")
      .filter((v): v is File => v instanceof File && v.size > 0)
      .slice(0, 10);
    const firstName = formStr(form, "firstName");
    const secondName = formStr(form, "secondName");
    const lastName = formStr(form, "lastName");
    const combinedName =
      formStr(form, "name") ||
      [firstName, secondName, lastName].filter(Boolean).join(" ");
    return {
      data: {
        name: combinedName,
        firstName: firstName || undefined,
        secondName: secondName || undefined,
        lastName: lastName || undefined,
        email: formStr(form, "email"),
        password: formStr(form, "password"),
        phone: formStr(form, "phone") || undefined,
        role: formStr(form, "role") || "TOURIST",
        businessName: formStr(form, "businessName") || undefined,
        kycType: formStr(form, "kycType") || undefined,
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
        mpesaTillOrPaybill: formStr(form, "mpesaTillOrPaybill") || undefined,
        businessPermitExpiresAt:
          formStr(form, "businessPermitExpiresAt") || undefined,
        traLicenceExpiresAt: formStr(form, "traLicenceExpiresAt") || undefined,
        termsAccepted:
          formStr(form, "termsAccepted") === "true" ||
          formStr(form, "termsAccepted") === "on",
        privacyAccepted:
          formStr(form, "privacyAccepted") === "true" ||
          formStr(form, "privacyAccepted") === "on",
        phoneOtpId: formStr(form, "phoneOtpId") || undefined,
        emailOtpId: formStr(form, "emailOtpId") || undefined,
        ownerIdDocUrl: formStr(form, "ownerIdDocUrl") || undefined,
        kraPinDocUrl: formStr(form, "kraPinDocUrl") || undefined,
        registrationCertUrl: formStr(form, "registrationCertUrl") || undefined,
        businessPermitUrl: formStr(form, "businessPermitUrl") || undefined,
        kycDocUrl: formStr(form, "kycDocUrl") || undefined,
        selfieDocUrl: formStr(form, "selfieDocUrl") || undefined,
        amenities: formAmenities(form),
      },
      files: {
        ownerIdDoc: formFile(form, "ownerIdDoc"),
        kraPinDoc: formFile(form, "kraPinDoc"),
        registrationCert: formFile(form, "registrationCert"),
        businessPermit: formFile(form, "businessPermit"),
        kycDoc: formFile(form, "kycDoc"),
        selfieDoc: formFile(form, "selfieDoc"),
        otherDocs,
      },
    };
  }

  const json = await request.json();
  const firstName =
    typeof json.firstName === "string" ? json.firstName.trim() : "";
  const secondName =
    typeof json.secondName === "string" ? json.secondName.trim() : "";
  const lastName =
    typeof json.lastName === "string" ? json.lastName.trim() : "";
  if (!json.name && (firstName || secondName || lastName)) {
    json.name = [firstName, secondName, lastName].filter(Boolean).join(" ");
  }
  if (secondName) json.secondName = secondName;
  if (lastName) json.lastName = lastName;
  return {
    data: json,
    files: {
      ownerIdDoc: null,
      kraPinDoc: null,
      registrationCert: null,
      businessPermit: null,
      kycDoc: null,
      selfieDoc: null,
      otherDocs: [],
    },
  };
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

export async function POST(request: Request) {
  try {
    const { data: raw, files } = await parseRegisterBody(request);

    // If files are present, treat them as satisfying URL requirements for zod
    // by injecting placeholders that get replaced after upload.
    if (files.ownerIdDoc && !raw.ownerIdDocUrl) {
      raw.ownerIdDocUrl = "https://pending.local/owner-id";
    }
    if (files.kraPinDoc && !raw.kraPinDocUrl) {
      raw.kraPinDocUrl = "https://pending.local/kra-pin";
    }
    if (files.registrationCert && !raw.registrationCertUrl) {
      raw.registrationCertUrl = "https://pending.local/reg-cert";
    }
    if (files.businessPermit && !raw.businessPermitUrl) {
      raw.businessPermitUrl = "https://pending.local/permit";
    }
    if (files.kycDoc && !raw.kycDocUrl) {
      raw.kycDocUrl = "https://pending.local/kyc";
    }
    if (files.selfieDoc && !raw.selfieDocUrl) {
      raw.selfieDocUrl = "https://pending.local/selfie";
    }

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      const first =
        parsed.error.issues[0]?.message || "Invalid registration data";
      return NextResponse.json(
        { error: first, details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const settings = await getPlatformSettings();
    if (!boolSetting(settings, "security.allowSelfSignup")) {
      return NextResponse.json(
        { error: "Public sign-up is currently disabled" },
        { status: 403 },
      );
    }
    const minLen = numberSetting(settings, "security.minPasswordLength") || 6;
    if (parsed.data.password.length < minLen) {
      return NextResponse.json(
        { error: `Password must be at least ${minLen} characters` },
        { status: 400 },
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const firstName = parsed.data.firstName?.trim() || "";
    const secondName = parsed.data.secondName?.trim() || "";
    const lastName = parsed.data.lastName?.trim() || "";
    const fullName =
      parsed.data.name?.trim() ||
      [firstName, secondName, lastName].filter(Boolean).join(" ");
    const phoneResult = validateKenyanPhone(parsed.data.phone, {
      required: true,
    });
    if (phoneResult.error) {
      return NextResponse.json({ error: phoneResult.error }, { status: 400 });
    }
    const phone = phoneResult.phone;
    const kycType = (parsed.data.kycType ?? "INDIVIDUAL") as
      | "INDIVIDUAL"
      | "COMPANY";
    const idNumber =
      parsed.data.role === "PROVIDER"
        ? normalizeIdNumber(parsed.data.idNumber)
        : null;
    const registrationNumber =
      parsed.data.role === "PROVIDER"
        ? normalizeRegistrationNumber(parsed.data.registrationNumber)
        : null;

    if (parsed.data.role === "PROVIDER" && !idNumber) {
      return NextResponse.json(
        { error: "Enter a valid national ID number" },
        { status: 400 },
      );
    }
    if (
      parsed.data.role === "PROVIDER" &&
      kycType === "COMPANY" &&
      !registrationNumber
    ) {
      return NextResponse.json(
        { error: "Enter a valid company registration number" },
        { status: 400 },
      );
    }

    const clash = await findIdentityClash({
      email,
      phone,
      idNumber,
      registrationNumber,
      kraPin: parsed.data.kraPin,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });
    if (clash) {
      return NextResponse.json({ error: clash.message }, { status: 409 });
    }

    if (parsed.data.role === "PROVIDER") {
      const phoneOtpId = parsed.data.phoneOtpId;
      const emailOtpId = parsed.data.emailOtpId;
      if (phoneOtpId) {
        const phoneOtpErr = await assertVerifiedOtp({
          otpId: phoneOtpId,
          channel: "phone",
          destination: phone || "",
        });
        if (phoneOtpErr) {
          return NextResponse.json({ error: phoneOtpErr }, { status: 400 });
        }
      } else if (emailOtpId) {
        const emailOtpErr = await assertVerifiedOtp({
          otpId: emailOtpId,
          channel: "email",
          destination: email,
        });
        if (emailOtpErr) {
          return NextResponse.json({ error: emailOtpErr }, { status: 400 });
        }
      } else {
        return NextResponse.json(
          { error: "Verify your phone (SMS) or email before submitting" },
          { status: 400 },
        );
      }
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const role = parsed.data.role as Role;
    const userId = createId();
    const now = new Date().toISOString();

    const { data: user, error: userError } = await db
      .from("User")
      .insert({
        id: userId,
        name: fullName,
        email,
        phone,
        passwordHash,
        role,
        createdAt: now,
        updatedAt: now,
      })
      .select("id, email, name, role")
      .single();
    if (userError) throw userError;

    if (role === "PROVIDER") {
      const businessName = parsed.data.businessName?.trim() || fullName;
      const slugBase = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = `${slugBase || "provider"}-${userId.slice(-6)}`;
      const providerId = createId();

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
      let selfieDocUrl = parsed.data.selfieDocUrl?.startsWith(
        "https://pending.local/",
      )
        ? null
        : parsed.data.selfieDocUrl || null;
      const otherDocsUrls: string[] = [];

      try {
        if (files.ownerIdDoc) {
          ownerIdDocUrl = await uploadIfPresent(
            files.ownerIdDoc,
            userId,
            "owner-id",
          );
        }
        if (files.selfieDoc) {
          selfieDocUrl = await uploadIfPresent(
            files.selfieDoc,
            userId,
            "selfie-id",
          );
        }
        if (files.kraPinDoc) {
          kraPinDocUrl = await uploadIfPresent(
            files.kraPinDoc,
            userId,
            "kra-pin",
          );
        }
        if (files.registrationCert) {
          registrationCertUrl = await uploadIfPresent(
            files.registrationCert,
            userId,
            "certificate-of-incorporation",
          );
        }
        if (files.businessPermit) {
          businessPermitUrl = await uploadIfPresent(
            files.businessPermit,
            userId,
            "business-permit",
          );
        }
        if (files.kycDoc) {
          kycDocUrl = await uploadIfPresent(files.kycDoc, userId, "cr12");
        }
        for (let i = 0; i < files.otherDocs.length; i++) {
          const url = await uploadIfPresent(
            files.otherDocs[i],
            userId,
            `other-${i + 1}`,
          );
          if (url) otherDocsUrls.push(url);
        }
      } catch (uploadErr) {
        await db.from("User").delete().eq("id", userId);
        const msg =
          uploadErr instanceof Error
            ? uploadErr.message
            : "Could not upload verification documents";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      if (!ownerIdDocUrl) {
        await db.from("User").delete().eq("id", userId);
        return NextResponse.json(
          { error: "Upload a photo/scan of the owner's national ID" },
          { status: 400 },
        );
      }
      if (!selfieDocUrl) {
        await db.from("User").delete().eq("id", userId);
        return NextResponse.json(
          { error: "Upload a selfie holding your national ID" },
          { status: 400 },
        );
      }
      if (!kraPinDocUrl) {
        await db.from("User").delete().eq("id", userId);
        return NextResponse.json(
          { error: "Upload the KRA PIN document" },
          { status: 400 },
        );
      }
      if (!registrationCertUrl) {
        await db.from("User").delete().eq("id", userId);
        return NextResponse.json(
          { error: "Upload the certificate of incorporation" },
          { status: 400 },
        );
      }
      if (!businessPermitUrl) {
        await db.from("User").delete().eq("id", userId);
        return NextResponse.json(
          { error: "Upload the business permit / tourism licence" },
          { status: 400 },
        );
      }
      if (!kycDocUrl) {
        await db.from("User").delete().eq("id", userId);
        return NextResponse.json(
          { error: "Upload the CR12 / supporting document" },
          { status: 400 },
        );
      }

      const verification = verificationInsertFromParsed({
        ...parsed.data,
        ownerIdDocUrl,
        kraPinDocUrl,
        registrationCertUrl,
        businessPermitUrl,
        kycDocUrl,
        selfieDocUrl,
        otherDocsUrls,
      });

      // Clash already checked before user insert — skip re-check against self.
      const approval = await resolveHardGateAutoApproval(
        {
          kycType,
          phoneVerifiedAt: parsed.data.phoneOtpId ? now : null,
          emailVerifiedAt: parsed.data.emailOtpId ? now : null,
          termsAcceptedAt: verification.termsAcceptedAt,
          privacyAcceptedAt: verification.privacyAcceptedAt,
          kraPin: verification.kraPin,
          mpesaTillOrPaybill: verification.mpesaTillOrPaybill,
          ownerIdDocUrl,
          selfieDocUrl,
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
          email: verification.companyEmail || email,
        },
        settings,
        { skipIdentityClash: true },
      );

      const { error: providerError } = await db.from("Provider").insert({
        id: providerId,
        name: businessName,
        slug,
        email: verification.companyEmail || email,
        phone,
        payoutPhone: phone,
        kycType,
        idNumber,
        registrationNumber,
        ...verification,
        phoneVerifiedAt: parsed.data.phoneOtpId ? now : null,
        emailVerifiedAt: parsed.data.emailOtpId ? now : null,
        kycStatus: approval.kycStatus,
        isApproved: approval.isApproved,
        commissionRate:
          Math.round(numberSetting(settings, "fees.defaultCommission")) || 10,
        createdAt: now,
        updatedAt: now,
      });
      if (providerError) {
        await db.from("User").delete().eq("id", userId);
        throw providerError;
      }

      if (approval.autoApproved) {
        try {
          await logAudit({
            actor: { id: userId, name: fullName, email },
            action: "provider.auto_approve",
            entityType: "Provider",
            entityId: providerId,
            summary: `Hard-gate auto-approved "${businessName}" on registration`,
          });
        } catch {
          /* non-blocking */
        }
      }

      // Clear signup draft if any
      try {
        await db.from("ProviderSignupDraft").delete().eq("email", email);
      } catch {
        /* optional table */
      }

      const { error: memberError } = await db.from("ProviderMember").insert({
        id: createId(),
        providerId,
        userId,
        role: "OWNER",
      });
      if (memberError) {
        await db.from("Provider").delete().eq("id", providerId);
        await db.from("User").delete().eq("id", userId);
        throw memberError;
      }

      try {
        await setActiveProviderCookie(providerId);
      } catch {
        // Cookie may be unavailable in some edge contexts — client can switch later
      }
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : error instanceof Error
          ? error.message
          : "Registration failed";
    const isDb =
      message.includes("violates") ||
      message.includes("duplicate") ||
      message.includes("null value") ||
      message.includes("column") ||
      message.includes("unique");
    const missingVerificationCol =
      isDb &&
      /ownerIdDocUrl|kraPinDocUrl|registrationCertUrl|businessPermitUrl|companyEmail|postalAddress|businessType|operatingDays|opensAt|closesAt|establishedDate|countyId|townId|website|directors|otherDocsUrls|registrantRole/i.test(
        message,
      );
    return NextResponse.json(
      {
        error: missingVerificationCol
          ? "Database needs db/2026-provider-verification.sql applied before provider signup."
          : isDb
            ? message.toLowerCase().includes("phone")
              ? "An account with this phone number already exists"
              : message.toLowerCase().includes("registration")
                ? "A provider with this company registration number already exists"
                : message.toLowerCase().includes("email")
                  ? "An account with this email already exists"
                  : `Could not create account: ${message}`
            : "Registration failed — please try again",
      },
      { status: isDb ? (missingVerificationCol ? 503 : 409) : 503 },
    );
  }
}
