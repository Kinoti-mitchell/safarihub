import { z } from "zod";
import { auth } from "@/lib/auth";
import { findAllIdentityClashes } from "@/lib/identity";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  idNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  kraPin: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  /** When adding another business under a logged-in account */
  excludeUserId: z.string().optional().nullable(),
  excludeProviderId: z.string().optional().nullable(),
});

/**
 * Early duplicate check for registration / add-business steps.
 * Returns every conflicting field so the UI can show errors inline.
 */
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Invalid check payload", 400);

    const session = await auth().catch(() => null);
    const excludeUserId =
      parsed.data.excludeUserId || session?.user?.id || null;

    const clashes = await findAllIdentityClashes({
      email: parsed.data.email,
      phone: parsed.data.phone,
      idNumber: parsed.data.idNumber,
      registrationNumber: parsed.data.registrationNumber,
      kraPin: parsed.data.kraPin,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      excludeUserId,
      excludeProviderId: parsed.data.excludeProviderId,
    });

    const fieldErrors: Record<string, string> = {};
    for (const c of clashes) {
      fieldErrors[c.field] = c.message;
    }

    return jsonOk({
      ok: clashes.length === 0,
      clashes,
      fieldErrors,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
