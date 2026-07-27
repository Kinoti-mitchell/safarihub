import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error.message === "PROVIDER_NOT_APPROVED") {
      return jsonError(
        "Your business is awaiting admin approval. You cannot list properties or run operations until approved.",
        403,
      );
    }
    if (error.name === "PrismaClientInitializationError") {
      return jsonError("Database is not connected", 503);
    }
    // Surface validation / upload messages to the client
    if (
      error.name === "ZodError" ||
      error.message.includes("Image") ||
      error.message.includes("Allowed") ||
      error.message.includes("Supabase") ||
      error.message.includes("Bucket") ||
      error.message.includes("required") ||
      error.message.includes("not found") ||
      error.message.includes("configured")
    ) {
      return jsonError(error.message, 400);
    }
  }
  console.error(error);
  return jsonError(
    error instanceof Error ? error.message : "Server error",
    500,
  );
}
