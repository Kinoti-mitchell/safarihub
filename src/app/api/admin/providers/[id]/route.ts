import { db } from "@/lib/supabase";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireAdminPermission } from "@/lib/session";
import { listAuditLogs } from "@/lib/audit";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { notifyAndEmail } from "@/lib/notify";
import { resolveHardGateAutoApproval } from "@/lib/provider-auto-approval";
import { getPlatformName } from "@/lib/branding";
import { getPlatformSettings } from "@/lib/settings";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdminPermission("listing.publish");
    const { id } = await params;

    const { data: provider, error } = await db
      .from("Provider")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!provider) return jsonError("Provider not found", 404);

    const [
      membersRes,
      listingsRes,
      bookingsRes,
      payoutsRes,
      ordersRes,
      history,
    ] = await Promise.all([
      db
        .from("ProviderMember")
        .select("id, role, user:User(id, name, email, phone, createdAt)")
        .eq("providerId", id),
      db
        .from("Listing")
        .select(
          "id, title, slug, category, status, description, address, featured, isPromoted, boostEndsAt, amenities, createdAt, updatedAt, county:County(name), town:Town(name), media:Media(id, url, isCover, sortOrder), roomTypes:RoomType(id, name, basePrice, quantity, offerKind)",
        )
        .eq("providerId", id)
        .order("createdAt", { ascending: false }),
      db
        .from("Booking")
        .select(
          "id, reference, status, paymentStatus, totalAmount, createdAt, listing:Listing!inner(providerId, title)",
        )
        .eq("listing.providerId", id)
        .order("createdAt", { ascending: false })
        .limit(25),
      db
        .from("Payout")
        .select("id, amount, commission, status, createdAt")
        .eq("providerId", id)
        .order("createdAt", { ascending: false })
        .limit(20),
      db
        .from("SupplierOrder")
        .select(
          "id, status, totalAmount, quantity, createdAt, supplier:Supplier(name)",
        )
        .eq("providerId", id)
        .order("createdAt", { ascending: false })
        .limit(15),
      listAuditLogs({ entityType: "Provider", entityId: id, limit: 20 }),
    ]);

    const listings = (
      (listingsRes.data ?? []) as unknown as Array<{
        id: string;
        title: string;
        slug: string;
        category: string;
        status: string;
        description: string | null;
        address: string | null;
        featured: boolean;
        isPromoted: boolean;
        boostEndsAt: string | null;
        amenities: unknown;
        createdAt: string;
        updatedAt: string;
        county: { name: string } | null;
        town: { name: string } | null;
        media: Array<{
          id: string;
          url: string;
          isCover: boolean;
          sortOrder: number;
        }>;
        roomTypes: Array<{
          id: string;
          name: string;
          basePrice: number;
          quantity: number;
          offerKind: string | null;
        }>;
      }>
    ).map((l) => {
      const prices = l.roomTypes.map((r) => r.basePrice).filter((p) => p > 0);
      const cover =
        l.media.find((m) => m.isCover) ||
        [...l.media].sort((a, b) => a.sortOrder - b.sortOrder)[0] ||
        null;
      const amenityCount = Array.isArray(l.amenities) ? l.amenities.length : 0;
      return {
        id: l.id,
        title: l.title,
        slug: l.slug,
        category: l.category,
        status: l.status,
        description: l.description,
        address: l.address,
        featured: Boolean(l.featured),
        isPromoted: Boolean(l.isPromoted),
        boostEndsAt: l.boostEndsAt,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        countyName: l.county?.name ?? "—",
        townName: l.town?.name ?? null,
        photoCount: l.media.length,
        coverUrl: cover?.url ?? null,
        offerCount: l.roomTypes.length,
        amenityCount,
        fromPrice: prices.length ? Math.min(...prices) : null,
        offers: l.roomTypes.slice(0, 4).map((r) => ({
          name: r.name,
          basePrice: r.basePrice,
          quantity: r.quantity,
          offerKind: r.offerKind,
        })),
      };
    });

    const bookings = (bookingsRes.data ?? []) as unknown as Array<{
      id: string;
      reference: string;
      status: string;
      paymentStatus: string;
      totalAmount: number;
      createdAt: string;
      listing: { title: string } | null;
    }>;

    const paidRevenue = bookings
      .filter((b) => b.paymentStatus === "PAID" || b.paymentStatus === "NOT_REQUIRED")
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    const settings = await getPlatformSettings();
    let ownerUserId: string | null = null;
    for (const raw of membersRes.data ?? []) {
      const m = raw as {
        role?: string;
        user?: { id?: string } | { id?: string }[] | null;
      };
      if (m.role !== "OWNER" && m.role !== "PROVIDER") continue;
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      if (u?.id) {
        ownerUserId = u.id;
        break;
      }
    }

    const approval = await resolveHardGateAutoApproval(
      {
        id: provider.id as string,
        kycType: provider.kycType as string | null,
        phoneVerifiedAt: provider.phoneVerifiedAt as string | null,
        emailVerifiedAt: provider.emailVerifiedAt as string | null,
        termsAcceptedAt: provider.termsAcceptedAt as string | null,
        privacyAcceptedAt: provider.privacyAcceptedAt as string | null,
        kraPin: provider.kraPin as string | null,
        mpesaTillOrPaybill: provider.mpesaTillOrPaybill as string | null,
        ownerIdDocUrl: provider.ownerIdDocUrl as string | null,
        selfieDocUrl: provider.selfieDocUrl as string | null,
        kraPinDocUrl: provider.kraPinDocUrl as string | null,
        businessPermitUrl: provider.businessPermitUrl as string | null,
        registrationCertUrl: provider.registrationCertUrl as string | null,
        kycDocUrl: provider.kycDocUrl as string | null,
        businessPermitExpiresAt: provider.businessPermitExpiresAt as string | null,
        amenities: provider.amenities,
        latitude: provider.latitude as number | null,
        longitude: provider.longitude as number | null,
        countyId: provider.countyId as string | null,
        townId: provider.townId as string | null,
        idNumber: provider.idNumber as string | null,
        registrationNumber: provider.registrationNumber as string | null,
        phone: provider.phone as string | null,
        email: provider.email as string | null,
      },
      settings,
      {
        excludeUserId: ownerUserId,
        excludeProviderId: id,
      },
    );

    let countyName: string | null = null;
    let townName: string | null = null;
    const countyId = provider.countyId as string | null;
    const townId = provider.townId as string | null;
    if (countyId || townId) {
      const [countyRes, townRes] = await Promise.all([
        countyId
          ? db.from("County").select("name").eq("id", countyId).maybeSingle()
          : Promise.resolve({ data: null }),
        townId
          ? db.from("Town").select("name").eq("id", townId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      countyName = (countyRes.data as { name?: string } | null)?.name ?? null;
      townName = (townRes.data as { name?: string } | null)?.name ?? null;
    }

    return jsonOk({
      provider: {
        ...provider,
        countyName,
        townName,
      },
      hardGates: approval.gates,
      autoApproveEnabled: approval.enabled,
      members: membersRes.data ?? [],
      listings,
      bookings: bookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        paymentStatus: b.paymentStatus,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
        listingTitle: b.listing?.title ?? "—",
      })),
      payouts: payoutsRes.data ?? [],
      supplierOrders: ordersRes.error ? [] : ordersRes.data ?? [],
      history: history.map((h) => ({
        ...h,
        createdAt:
          h.createdAt instanceof Date
            ? h.createdAt.toISOString()
            : String(h.createdAt),
      })),
      stats: {
        listingCount: listings.length,
        publishedCount: listings.filter((l) => l.status === "PUBLISHED").length,
        bookingCount: bookings.length,
        revenue: paidRevenue,
        memberCount: (membersRes.data ?? []).length,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminPermission("listing.publish");
    const { id } = await params;
    const body = z
      .object({
        isApproved: z.boolean().optional(),
        commissionRate: z.number().int().min(0).max(50).optional(),
        kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
        rejectionReason: z.string().max(2000).optional().nullable(),
        rejectionCodes: z.array(z.string().max(40)).max(20).optional().nullable(),
      })
      .parse(await request.json());

    const { formatRejectionSummary } = await import("@/lib/kyc-reject-codes");

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.commissionRate != null) patch.commissionRate = body.commissionRate;
    if (body.kycStatus != null) patch.kycStatus = body.kycStatus;
    if (body.isApproved != null) {
      patch.isApproved = body.isApproved;
      if (body.isApproved && body.kycStatus !== "REJECTED") {
        patch.kycStatus = body.kycStatus ?? "VERIFIED";
        patch.rejectionReason = null;
        patch.rejectionCodes = null;
        patch.rejectedAt = null;
      }
    }
    if (
      body.kycStatus === "REJECTED" ||
      (body.isApproved === false &&
        (body.rejectionReason || (body.rejectionCodes && body.rejectionCodes.length)))
    ) {
      patch.kycStatus = "REJECTED";
      patch.isApproved = false;
      patch.rejectionCodes = body.rejectionCodes?.length
        ? body.rejectionCodes
        : null;
      patch.rejectionReason = formatRejectionSummary(
        body.rejectionCodes,
        body.rejectionReason,
      );
      patch.rejectedAt = new Date().toISOString();
    }

    const { data: provider, error } = await db
      .from("Provider")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: body.isApproved
        ? "provider.approve"
        : body.kycStatus
          ? `provider.kyc.${body.kycStatus.toLowerCase()}`
          : "provider.update",
      entityType: "Provider",
      entityId: provider.id,
      summary: body.isApproved
        ? `Approved provider "${provider.name}" (commission ${provider.commissionRate}%, KYC ${provider.kycStatus})`
        : body.kycStatus
          ? `KYC ${body.kycStatus.toLowerCase()} for "${provider.name}"`
          : `Updated provider "${provider.name}"`,
      metadata: body,
    });

    const platformName = await getPlatformName();

    // Confirmation to every team member when business is approved
    if (body.isApproved === true) {
      const { data: members } = await db
        .from("ProviderMember")
        .select("user:User(id, email, name)")
        .eq("providerId", id);
      for (const row of members ?? []) {
        const user = Array.isArray(row.user) ? row.user[0] : row.user;
        if (!user?.id) continue;
        await notifyAndEmail({
          userId: user.id as string,
          email: (user.email as string) || null,
          type: "provider.approved",
          title: `${provider.name} is approved`,
          body: `Good news — your business "${provider.name}" has been approved on ${platformName}. You can now create listings and run your hospitality OS.`,
          href: "/provider",
        });
      }
    }

    if (body.kycStatus === "REJECTED" || body.isApproved === false) {
      const { data: members } = await db
        .from("ProviderMember")
        .select("user:User(id, email, name)")
        .eq("providerId", id);
      for (const row of members ?? []) {
        const user = Array.isArray(row.user) ? row.user[0] : row.user;
        if (!user?.id) continue;
        await notifyAndEmail({
          userId: user.id as string,
          email: (user.email as string) || null,
          type: "provider.rejected",
          title: `${provider.name} needs attention`,
          body:
            body.kycStatus === "REJECTED" || body.isApproved === false
              ? `KYC for "${provider.name}" was rejected.${
                  provider.rejectionReason
                    ? ` Reason: ${provider.rejectionReason}`
                    : ""
                } Update your documents at Compliance and resubmit for review.`
              : `"${provider.name}" is not approved to operate on ${platformName} yet.`,
          href: "/provider/compliance",
        });
      }
    }

    return jsonOk({ provider });
  } catch (error) {
    return handleRouteError(error);
  }
}
