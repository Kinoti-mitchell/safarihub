import { jsonOk } from "@/lib/http";

/** Daraja B2C result callback — acknowledge receipt. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    console.info("mpesa b2c result", JSON.stringify(body).slice(0, 2000));
  } catch {
    // ignore parse errors
  }
  return jsonOk({ ResultCode: 0, ResultDesc: "Accepted" });
}
