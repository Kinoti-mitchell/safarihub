import { NextResponse } from "next/server";

/** Lightweight health check for Render / load balancers — no DB. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "safari-hub" });
}
