import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  getProviderForUser,
  setActiveProviderCookie,
} from "@/lib/provider";
import { listingCompleteness, publicProviderPath } from "@/lib/listing-paths";
import { ProviderDashboardCharts } from "@/components/provider-dashboard-charts";
import {
  buildProviderChartData,
  type ChartBooking,
  type ProviderChartData,
} from "@/lib/provider-charts";

const ONBOARDING_MODULES = [
  {
    href: "/provider/listings",
    title: "Listings",
    body: "Publish stays, dining, transport and experiences travellers book.",
  },
  {
    href: "/provider/bookings",
    title: "Bookings & payments",
    body: "Confirm guests. Collect via M-Pesa, card or cash on arrival.",
  },
  {
    href: "/provider/staff",
    title: "Staff",
    body: "Invite managers and front desk — one business, shared access.",
  },
  {
    href: "/provider/compliance",
    title: "Compliance",
    body: "KYC status and eTIMS invoice queue for audit-ready records.",
  },
  {
    href: "/provider/payouts",
    title: "Payouts",
    body: "Track net earnings and M-Pesa settlements.",
  },
  {
    href: "/provider/business",
    title: "Business profile",
    body: "Logo, phone, description and guest-facing terms.",
  },
] as const;

type AttentionItem = {
  href: string;
  label: string;
  detail: string;
  tone: "urgent" | "setup";
};

export default async function ProviderDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const access = await getProviderForUser(session.user.id);
  if (access) {
    await setActiveProviderCookie(access.provider.id).catch(() => undefined);
  }

  let analytics: {
    listings: number;
    bookings: number;
    revenue: number;
    avgRating: number;
    approved: boolean;
  } | null = null;
  let checklist: {
    approved: boolean;
    listingCount: number;
    publishedCount: number;
    incomplete: { id: string; title: string; missing: string[] }[];
    newInquiries: number;
    unreadInbox: number;
    pendingBookings: number;
    kycOk: boolean;
    payoutPhone: boolean;
    openSupplierOrders: number;
    etimsQueued: number;
  } | null = null;
  let chartData: ProviderChartData | null = null;

  if (access) {
    try {
      const providerId = access.provider.id;
      const provider = access.provider as Record<string, unknown>;
      const [
        listingRowsRes,
        bookingsRes,
        reviewsRes,
        inquiriesRes,
        inboxRes,
        ordersRes,
        etimsRes,
        pendingBookingsRes,
      ] = await Promise.all([
        db
          .from("Listing")
          .select("*, media:Media(*), roomTypes:RoomType(*)")
          .eq("providerId", providerId),
        db
          .from("Booking")
          .select(
            "totalAmount, paymentStatus, status, createdAt, listing:Listing!inner(providerId, title)",
          )
          .eq("listing.providerId", providerId),
        db
          .from("Review")
          .select("rating, listing:Listing!inner(providerId)")
          .eq("listing.providerId", providerId),
        db
          .from("Inquiry")
          .select("id", { count: "exact", head: true })
          .eq("providerId", providerId)
          .eq("status", "NEW"),
        db
          .from("Conversation")
          .select("unreadForProvider")
          .eq("providerId", providerId)
          .gt("unreadForProvider", 0),
        db
          .from("SupplierOrder")
          .select("id", { count: "exact", head: true })
          .eq("providerId", providerId)
          .in("status", ["PENDING", "CONFIRMED"]),
        db
          .from("EtimsSubmission")
          .select("id", { count: "exact", head: true })
          .eq("providerId", providerId)
          .eq("status", "QUEUED"),
        db
          .from("Booking")
          .select("id, listing:Listing!inner(providerId)", {
            count: "exact",
            head: true,
          })
          .eq("listing.providerId", providerId)
          .in("status", ["PENDING", "RESERVED"]),
      ]);
      if (listingRowsRes.error) throw listingRowsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (reviewsRes.error) throw reviewsRes.error;

      const listingRows = (listingRowsRes.data ?? []) as unknown as Array<{
        id: string;
        title: string;
        status: string;
        description: string | null;
        latitude: number | null;
        longitude: number | null;
        media: unknown[];
        roomTypes: unknown[];
      }>;
      const bookingRows = (bookingsRes.data ?? []) as unknown as Array<{
        totalAmount: number;
        paymentStatus: string;
        status: string;
        createdAt: string;
        listing: { providerId: string; title: string } | null;
      }>;
      const reviewRows = (reviewsRes.data ?? []) as unknown as Array<{
        rating: number;
      }>;

      const chartBookings: ChartBooking[] = bookingRows.map((b) => ({
        totalAmount: b.totalAmount || 0,
        paymentStatus: b.paymentStatus,
        status: b.status,
        createdAt: b.createdAt,
        listingTitle: b.listing?.title || "Listing",
      }));
      chartData = buildProviderChartData(chartBookings, 14);

      const listings = listingRows.length;
      const bookings = bookingRows.length;
      const revenue = bookingRows
        .filter((b) => b.paymentStatus === "PAID" || b.status === "COMPLETED")
        .reduce((s, b) => s + (b.totalAmount || 0), 0);
      const avgRating =
        reviewRows.length === 0
          ? 0
          : Number(
              (
                reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length
              ).toFixed(1),
            );

      analytics = {
        listings,
        bookings,
        revenue,
        avgRating,
        approved: Boolean(access.provider.isApproved),
      };

      const incomplete = listingRows
        .filter((l) => l.status !== "PUBLISHED")
        .map((l) => {
          const c = listingCompleteness(l);
          const missing = (Object.entries(c.checks) as [string, boolean][])
            .filter(([, ok]) => !ok)
            .map(([k]) => k);
          return { id: l.id, title: l.title, missing };
        })
        .filter((l) => l.missing.length > 0);

      const kycStatus = String(provider.kycStatus || "PENDING");
      checklist = {
        approved: Boolean(access.provider.isApproved),
        listingCount: listings,
        publishedCount: listingRows.filter((l) => l.status === "PUBLISHED")
          .length,
        incomplete,
        newInquiries: inquiriesRes.count ?? 0,
        unreadInbox: (
          (inboxRes.data ?? []) as Array<{ unreadForProvider: number }>
        ).reduce((s, c) => s + (c.unreadForProvider || 0), 0),
        pendingBookings: pendingBookingsRes.error
          ? 0
          : (pendingBookingsRes.count ?? 0),
        kycOk: kycStatus === "VERIFIED" || kycStatus === "APPROVED",
        payoutPhone: Boolean(provider.payoutPhone || provider.phone),
        openSupplierOrders: ordersRes.error ? 0 : (ordersRes.count ?? 0),
        etimsQueued: etimsRes.error ? 0 : (etimsRes.count ?? 0),
      };
    } catch {
      analytics = null;
      checklist = null;
      chartData = null;
    }
  }

  const plan = String(
    (access?.provider as Record<string, unknown> | undefined)?.subscriptionPlan ||
      "STARTER",
  );

  const isLive =
    Boolean(checklist?.approved) && (checklist?.publishedCount ?? 0) > 0;
  const needsSetup =
    !checklist?.approved ||
    (checklist.listingCount === 0 && checklist.approved) ||
    !checklist.kycOk ||
    !checklist.payoutPhone ||
    checklist.incomplete.length > 0;

  const attention: AttentionItem[] = [];
  if (checklist) {
    if (checklist.pendingBookings > 0) {
      attention.push({
        href: "/provider/bookings",
        label: "Bookings awaiting decision",
        detail: `${checklist.pendingBookings} to confirm or decline`,
        tone: "urgent",
      });
    }
    if (checklist.unreadInbox > 0) {
      attention.push({
        href: "/provider/inbox",
        label: "Unread guest messages",
        detail: `${checklist.unreadInbox} in inbox`,
        tone: "urgent",
      });
    }
    if (checklist.newInquiries > 0) {
      attention.push({
        href: "/provider/inquiries",
        label: "Open guest inquiries",
        detail: `${checklist.newInquiries} legacy lead${checklist.newInquiries === 1 ? "" : "s"}`,
        tone: "urgent",
      });
    }
    if (checklist.etimsQueued > 0) {
      attention.push({
        href: "/provider/compliance",
        label: "eTIMS queue",
        detail: `${checklist.etimsQueued} to submit`,
        tone: "urgent",
      });
    }
    if (checklist.openSupplierOrders > 0) {
      attention.push({
        href: "/provider/suppliers",
        label: "Open supplier orders",
        detail: `${checklist.openSupplierOrders} in progress`,
        tone: "urgent",
      });
    }
    for (const listing of checklist.incomplete.slice(0, 3)) {
      attention.push({
        href: `/provider/listings/${listing.id}`,
        label: `Finish “${listing.title}”`,
        detail: `Missing ${listing.missing.join(", ")}`,
        tone: "setup",
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
        Today
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
        {access?.provider.name || session.user.name || "Your business"}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        {isLive
          ? "Focus on guests who need a reply or a decision."
          : "Get approved, publish a listing, then run the front desk from here."}
        {analytics && !analytics.approved ? " · Awaiting admin approval." : ""}
        {access?.provider.slug && analytics?.approved ? (
          <>
            {" · "}
            <Link
              href={publicProviderPath(access.provider)}
              className="font-medium text-lake-bright underline decoration-lake-bright/40 underline-offset-2"
            >
              Public storefront
            </Link>
          </>
        ) : access?.provider.slug && !analytics?.approved ? (
          <span className="text-ink-muted">
            {" · "}Public storefront unlocks after approval
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Plan: <span className="font-medium text-ink">{plan}</span>
      </p>

      {checklist && !checklist.approved && (
        <section className="provider-card mt-8 rounded-2xl border border-sun/35 bg-sun/10 p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Waiting for admin approval
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">
              {access?.provider.name}
            </span>{" "}
            is registered and under review. Finish your business profile and KYC
            while you wait — listings and staffing unlock after approval.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/provider/business"
              className="inline-flex rounded-xl bg-lake px-5 py-2.5 text-sm font-semibold text-sand transition hover:brightness-110"
            >
              Business profile
            </Link>
            <Link
              href="/provider/compliance"
              className="inline-flex rounded-xl border border-line bg-white/90 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-lake-bright"
            >
              Review KYC
            </Link>
          </div>
        </section>
      )}

      {checklist && checklist.approved && checklist.listingCount === 0 && (
        <section className="provider-card mt-8 rounded-2xl border border-sun/35 p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Next step: create your first listing
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">
              {access?.provider.name}
            </span>{" "}
            is approved. Add the property or experience guests will book —
            location, photos and prices.
          </p>
          <Link
            href="/provider/listings/new"
            className="mt-4 inline-flex rounded-xl bg-lake px-5 py-2.5 text-sm font-semibold text-sand transition hover:brightness-110"
          >
            Add listing for {access?.provider.name || "your business"}
          </Link>
        </section>
      )}

      {attention.length > 0 && (
        <section className="provider-card mt-8 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Needs attention</h2>
          <ul className="mt-4 space-y-3">
            {attention.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-line/80 bg-white/50 px-4 py-3 transition hover:border-lake-bright"
                >
                  <span>
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="mt-0.5 block text-sm text-ink-muted">
                      {item.detail}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-lake-bright">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLive && attention.length === 0 && (
        <section className="provider-card mt-8 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">All clear</h2>
          <p className="mt-2 text-sm text-ink-muted">
            No pending bookings or unread guest messages. When something needs
            you, it will show up here and on Bookings / Inbox in the sidebar.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/provider/bookings"
              className="inline-flex rounded-xl border border-line bg-white/90 px-4 py-2 text-sm font-semibold text-ink transition hover:border-lake-bright"
            >
              View bookings
            </Link>
            <Link
              href="/provider/inbox"
              className="inline-flex rounded-xl border border-line bg-white/90 px-4 py-2 text-sm font-semibold text-ink transition hover:border-lake-bright"
            >
              Open inbox
            </Link>
          </div>
        </section>
      )}

      {checklist && needsSetup && (
        <section className="provider-card mt-8 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">
            Setup checklist
          </h2>
          <ul className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
            <li>{checklist.approved ? "✓" : "○"} Business approved</li>
            <li>
              {checklist.kycOk ? "✓" : "○"} KYC verified
              {!checklist.kycOk && (
                <>
                  {" — "}
                  <Link
                    href="/provider/compliance"
                    className="text-lake-bright underline"
                  >
                    compliance
                  </Link>
                </>
              )}
            </li>
            <li>
              {checklist.publishedCount > 0 ? "✓" : "○"} Live listing (
              {checklist.publishedCount})
              {checklist.approved && checklist.listingCount === 0 && (
                <>
                  {" — "}
                  <Link
                    href="/provider/listings"
                    className="text-lake-bright underline"
                  >
                    create one
                  </Link>
                </>
              )}
              {!checklist.approved && (
                <span className="text-ink-muted"> — unlocks after approval</span>
              )}
            </li>
            <li>
              {checklist.payoutPhone ? "✓" : "○"} Business phone set
              {!checklist.payoutPhone && (
                <>
                  {" — "}
                  <Link
                    href="/provider/business"
                    className="text-lake-bright underline"
                  >
                    business profile
                  </Link>
                </>
              )}
            </li>
          </ul>
        </section>
      )}

      {analytics && (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Listings", value: String(analytics.listings) },
            { label: "Bookings", value: String(analytics.bookings) },
            {
              label: "Revenue",
              value: `KES ${analytics.revenue.toLocaleString()}`,
            },
            {
              label: "Avg rating",
              value: analytics.avgRating ? String(analytics.avgRating) : "—",
            },
          ].map((stat) => (
            <div key={stat.label} className="provider-card rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                {stat.label}
              </p>
              <p className="font-display mt-1 text-2xl font-semibold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {chartData && <ProviderDashboardCharts data={chartData} />}

      {!isLive && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Get started</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Core tools for launching your storefront. After you go live, daily
            work lives under Front desk in the sidebar.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ONBOARDING_MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="provider-module block rounded-2xl p-5"
              >
                <h3 className="font-display text-lg font-semibold text-ink">
                  {m.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {m.body}
                </p>
                <span className="mt-4 inline-block text-sm font-semibold text-lake-bright">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
