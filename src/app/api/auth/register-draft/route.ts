import { z } from "zod";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { normalizeEmail, normalizePhone } from "@/lib/identity";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const saveSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  step: z.number().int().min(0).max(20),
  payload: z.record(z.string(), z.unknown()),
});

/** Save / update a provider signup draft so the user can finish later. */
export async function POST(request: Request) {
  try {
    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("email and payload required", 400);

    const email = normalizeEmail(parsed.data.email);
    const phone = normalizePhone(parsed.data.phone || null);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DRAFT_TTL_MS).toISOString();

    const { data: existing } = await db
      .from("ProviderSignupDraft")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await db
        .from("ProviderSignupDraft")
        .update({
          phone,
          step: parsed.data.step,
          payload: parsed.data.payload,
          updatedAt: now.toISOString(),
          expiresAt,
        })
        .eq("id", existing.id);
      if (error) {
        if (/ProviderSignupDraft|does not exist/i.test(error.message)) {
          return jsonError(
            "Run db/2026-provider-verification-extras.sql for signup drafts.",
            503,
          );
        }
        throw error;
      }
      return jsonOk({ draftId: existing.id, message: "Progress saved" });
    }

    const id = createId("draft");
    const { error } = await db.from("ProviderSignupDraft").insert({
      id,
      email,
      phone,
      step: parsed.data.step,
      payload: parsed.data.payload,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
    });
    if (error) {
      if (/ProviderSignupDraft|does not exist/i.test(error.message)) {
        return jsonError(
          "Run db/2026-provider-verification-extras.sql for signup drafts.",
          503,
        );
      }
      throw error;
    }
    return jsonOk({ draftId: id, message: "Progress saved" }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Load a draft by email. */
export async function GET(request: Request) {
  try {
    const email = normalizeEmail(
      new URL(request.url).searchParams.get("email") || "",
    );
    if (!email) return jsonError("email required", 400);

    const { data, error } = await db
      .from("ProviderSignupDraft")
      .select("id, email, phone, step, payload, updatedAt, expiresAt")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      if (/ProviderSignupDraft|does not exist/i.test(error.message)) {
        return jsonOk({ draft: null });
      }
      throw error;
    }
    if (!data) return jsonOk({ draft: null });
    if (new Date(data.expiresAt as string).getTime() < Date.now()) {
      await db.from("ProviderSignupDraft").delete().eq("id", data.id);
      return jsonOk({ draft: null });
    }
    return jsonOk({ draft: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Delete draft after successful registration. */
export async function DELETE(request: Request) {
  try {
    const email = normalizeEmail(
      new URL(request.url).searchParams.get("email") || "",
    );
    if (!email) return jsonError("email required", 400);
    await db.from("ProviderSignupDraft").delete().eq("email", email);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
