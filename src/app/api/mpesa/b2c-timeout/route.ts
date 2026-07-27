import { handleRouteError, jsonOk } from "@/lib/http";

/** Daraja B2C queue timeout callback. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    console.info("mpesa b2c timeout", JSON.stringify(body).slice(0, 1000));
    return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    return handleRouteError(error);
  }
}
