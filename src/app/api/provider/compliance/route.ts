import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireProviderAccess } from "@/lib/provider";
import { createId } from "@/lib/ids";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    const provider = access.provider as Record<string, unknown>;
    const settings = await getPlatformSettings();

    const { data: submissions, error: sErr } = await db
      .from("EtimsSubmission")
      .select("*")
      .eq("providerId", access.provider.id)
      .order("createdAt", { ascending: false })
      .limit(50);
    // Table may not exist until migration is applied
    const queue = sErr ? [] : (submissions ?? []);

    const { data: paidBookings } = await db
      .from("Booking")
      .select(
        "id, reference, receiptNumber, totalAmount, vatAmount, paymentStatus, checkIn, listing:Listing!inner(title, providerId)",
      )
      .eq("listing.providerId", access.provider.id)
      .eq("paymentStatus", "PAID")
      .order("createdAt", { ascending: false })
      .limit(30);

    const queuedIds = new Set(
      (queue as Array<{ bookingId?: string }>)
        .map((q) => q.bookingId)
        .filter(Boolean),
    );
    const eligible = ((paidBookings ?? []) as Array<Record<string, unknown>>)
      .filter((b) => b.receiptNumber && !queuedIds.has(String(b.id)))
      .slice(0, 20);

    return jsonOk({
      kyc: {
        status: provider.kycStatus || "PENDING",
        type: provider.kycType || null,
        idNumber: provider.idNumber || null,
        registrationNumber: provider.registrationNumber || null,
        kraPin: provider.kraPin || null,
        etimsEnabled: Boolean(provider.etimsEnabled),
        rejectionReason: (provider.rejectionReason as string | null) || null,
        rejectedAt: (provider.rejectedAt as string | null) || null,
        isApproved: Boolean(provider.isApproved),
      },
      platformEtims: boolSetting(settings, "compliance.etimsEnabled"),
      etimsMode: String(settings["compliance.etimsMode"] || "manual"),
      queue,
      eligibleBookings: eligible,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await requireProviderAccess(session.user.id);
    const body = await req.json();
    const action = String(body.action || "queue");

    if (action === "savePin") {
      const kraPin = String(body.kraPin || "").trim();
      const { error } = await db
        .from("Provider")
        .update({
          kraPin: kraPin || null,
          etimsEnabled: Boolean(body.etimsEnabled),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", access.provider.id);
      if (error) throw error;
      return jsonOk({ saved: true });
    }

    if (action === "queue") {
      const bookingId = String(body.bookingId || "");
      if (!bookingId) return jsonError("bookingId required");

      const { data: booking, error: bErr } = await db
        .from("Booking")
        .select(
          "id, receiptNumber, totalAmount, vatAmount, paymentStatus, listing:Listing!inner(providerId)",
        )
        .eq("id", bookingId)
        .eq("listing.providerId", access.provider.id)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!booking) return jsonError("Booking not found", 404);
      if (booking.paymentStatus !== "PAID") {
        return jsonError("Only paid bookings can be queued for eTIMS");
      }

      const row = {
        id: createId("etims"),
        providerId: access.provider.id,
        bookingId: booking.id,
        receiptNumber: booking.receiptNumber,
        amount: booking.totalAmount || 0,
        vatAmount: booking.vatAmount || 0,
        status: "QUEUED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { error } = await db.from("EtimsSubmission").insert(row);
      if (error) {
        if (error.message?.includes("EtimsSubmission") || error.code === "42P01") {
          return jsonError(
            "Run db/2026-hospitality-os.sql in Supabase to enable the eTIMS queue.",
            503,
          );
        }
        throw error;
      }
      return jsonOk({ queued: true, submission: row });
    }

    if (action === "markSubmitted") {
      const id = String(body.id || "");
      const kraRef = String(body.kraRef || "").trim();
      if (!id) return jsonError("id required");
      const { error } = await db
        .from("EtimsSubmission")
        .update({
          status: "SUBMITTED",
          kraRef: kraRef || null,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("providerId", access.provider.id);
      if (error) throw error;
      return jsonOk({ submitted: true });
    }

    return jsonError("Unknown action");
  } catch (error) {
    return handleRouteError(error);
  }
}
