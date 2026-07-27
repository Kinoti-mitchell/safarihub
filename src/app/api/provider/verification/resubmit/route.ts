import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireProviderAccess } from "@/lib/provider";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { uploadKycDocument } from "@/lib/uploads";
import { normalizeKraPin } from "@/lib/provider-verification";

/**
 * Rejected providers resubmit verification docs / details → back to PENDING.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { provider } = await requireProviderAccess(session.user.id);

    if (provider.isApproved && provider.kycStatus === "VERIFIED") {
      return jsonError("Business is already approved", 400);
    }

    const contentType = request.headers.get("content-type") || "";
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      kycStatus: "PENDING",
      rejectionReason: null,
      rejectedAt: null,
      isApproved: false,
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const kraPin = normalizeKraPin(String(form.get("kraPin") || ""));
      if (kraPin) patch.kraPin = kraPin;
      const mpesa = String(form.get("mpesaTillOrPaybill") || "").trim();
      if (mpesa) patch.mpesaTillOrPaybill = mpesa;
      const permitExp = String(form.get("businessPermitExpiresAt") || "").trim();
      if (permitExp) patch.businessPermitExpiresAt = permitExp;
      const traExp = String(form.get("traLicenceExpiresAt") || "").trim();
      if (traExp) patch.traLicenceExpiresAt = traExp;

      async function up(name: string, kind: string, col: string) {
        const file = form.get(name);
        if (!(file instanceof File) || file.size === 0) return;
        const uploaded = await uploadKycDocument({
          ownerId: session!.user!.id,
          file,
          fileName: file.name || `${kind}.pdf`,
          contentType: file.type || "application/octet-stream",
          kind,
        });
        patch[col] = uploaded.publicUrl;
      }

      await up("ownerIdDoc", "owner-id", "ownerIdDocUrl");
      await up("selfieDoc", "selfie-id", "selfieDocUrl");
      await up("kraPinDoc", "kra-pin", "kraPinDocUrl");
      await up("registrationCert", "certificate-of-incorporation", "registrationCertUrl");
      await up("businessPermit", "business-permit", "businessPermitUrl");
      await up("kycDoc", "cr12", "kycDocUrl");
    } else {
      const body = z
        .object({
          kraPin: z.string().optional(),
          mpesaTillOrPaybill: z.string().optional(),
          businessPermitExpiresAt: z.string().optional(),
          note: z.string().max(1000).optional(),
        })
        .parse(await request.json());
      if (body.kraPin) patch.kraPin = normalizeKraPin(body.kraPin);
      if (body.mpesaTillOrPaybill)
        patch.mpesaTillOrPaybill = body.mpesaTillOrPaybill.trim();
      if (body.businessPermitExpiresAt)
        patch.businessPermitExpiresAt = body.businessPermitExpiresAt;
    }

    const { data, error } = await db
      .from("Provider")
      .update(patch)
      .eq("id", provider.id)
      .select("id, name, kycStatus, rejectionReason")
      .single();
    if (error) throw error;

    return jsonOk({
      provider: data,
      message: "Resubmitted for admin review",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
