import { z } from "zod";
import { verifyOtp } from "@/lib/otp";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  otpId: z.string().min(1),
  code: z.string().min(4).max(8),
  destination: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("otpId and code required", 400);

    const result = await verifyOtp(parsed.data);
    if (!result.ok) return jsonError(result.error, 400);

    return jsonOk({
      verified: true,
      channel: result.channel,
      destination: result.destination,
      otpId: parsed.data.otpId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
