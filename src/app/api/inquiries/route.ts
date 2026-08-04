import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createId } from "@/lib/ids";
import { getProviderForUser } from "@/lib/provider";
import { getPlatformSettings, boolSetting } from "@/lib/settings";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { notify } from "@/lib/notify";
import { emailAdminRecipients } from "@/lib/admin-alerts";
import { sendEmail } from "@/lib/email";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const access = await getProviderForUser(session.user.id);
    if (!access && session.user.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    let query = db
      .from("Inquiry")
      .select(
        "*, listing:Listing(id, title, slug), traveler:User(name, email)",
      )
      .order("createdAt", { ascending: false })
      .limit(100);
    if (!(session.user.role === "ADMIN" && !access)) {
      query = query.eq("providerId", access!.provider.id);
    }
    const { data: inquiries, error } = await query;
    if (error) throw error;
    return jsonOk({ inquiries });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  listingId: z.string(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(10),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const settings = await getPlatformSettings();
    if (!boolSetting(settings, "flags.inquiriesEnabled")) {
      return jsonError("Inquiries are currently disabled", 400);
    }
    const body = createSchema.parse(await request.json());
    const { data: listing } = await db
      .from("Listing")
      .select("id, providerId, status, title")
      .eq("id", body.listingId)
      .maybeSingle();
    if (!listing || listing.status !== "PUBLISHED") {
      return jsonError("Listing not available", 400);
    }

    const { data: inquiry, error } = await db
      .from("Inquiry")
      .insert({
        id: createId(),
        listingId: listing.id,
        providerId: listing.providerId,
        travelerId: session?.user?.id || null,
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        message: body.message,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { data: members } = await db
      .from("ProviderMember")
      .select("userId, user:User(email)")
      .eq("providerId", listing.providerId as string);

    const subject = `New inquiry · ${listing.title || "Listing"}`;
    const text = `${body.name} wrote:\n\n${body.message}\n\nReply: ${body.email}${body.phone ? ` · ${body.phone}` : ""}`;

    for (const m of members ?? []) {
      await notify({
        userId: m.userId as string,
        type: "inquiry.new",
        title: subject,
        body: text.slice(0, 280),
        href: "/provider/inquiries",
      });
      const memberEmail = (m.user as { email?: string } | null)?.email;
      if (memberEmail && boolSetting(settings, "notifications.emailOnInquiry")) {
        await sendEmail({ to: memberEmail, subject, text });
      }
    }

    if (boolSetting(settings, "notifications.emailOnInquiry")) {
      await emailAdminRecipients({ subject, text });
    }

    return jsonOk({ inquiry }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
