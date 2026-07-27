import { z } from "zod";
import { createAndSendOtp } from "@/lib/otp";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  channel: z.enum(["phone", "email"]),
  destination: z.string().min(3),
  purpose: z.enum(["signup", "login"]).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("channel and destination required", 400);

    const purpose = parsed.data.purpose ?? "signup";
    if (purpose === "login" && parsed.data.channel !== "phone") {
      return jsonError("Login codes are sent by SMS to your phone", 400);
    }

    const result = await createAndSendOtp({
      channel: parsed.data.channel,
      destination: parsed.data.destination,
      purpose,
    });
    if (!result.ok) return jsonError(result.error, 400);

    return jsonOk({
      otpId: result.otpId,
      message:
        purpose === "login"
          ? "Login code sent by SMS"
          : parsed.data.channel === "phone"
            ? "Verification code sent by SMS"
            : "Verification code sent by email",
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
