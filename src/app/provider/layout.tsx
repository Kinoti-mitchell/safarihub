import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProviderSidebar } from "@/components/provider-sidebar";
import { ProviderShellHeader } from "@/components/provider-shell-header";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { ProviderApprovalGate } from "@/components/provider-approval-gate";
import { ProviderRoleGate } from "@/components/provider-role-gate";
import { TabSessionGate } from "@/components/tab-session-gate";
import { getProviderForUser } from "@/lib/provider";
import { boolSetting, getPlatformSettings } from "@/lib/settings";
import { db } from "@/lib/supabase";

function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

async function loadNavBadges(providerId: string) {
  try {
    const [inboxRes, bookingsRes, inquiriesRes] = await Promise.all([
      db
        .from("Conversation")
        .select("unreadForProvider")
        .eq("providerId", providerId)
        .gt("unreadForProvider", 0),
      db
        .from("Booking")
        .select("id, listing:Listing!inner(providerId)", {
          count: "exact",
          head: true,
        })
        .eq("listing.providerId", providerId)
        .in("status", ["PENDING", "RESERVED"]),
      db
        .from("Inquiry")
        .select("id", { count: "exact", head: true })
        .eq("providerId", providerId)
        .eq("status", "NEW"),
    ]);

    const unreadInbox = (
      (inboxRes.data ?? []) as Array<{ unreadForProvider: number }>
    ).reduce((s, c) => s + (c.unreadForProvider || 0), 0);
    const openInquiries = inquiriesRes.error ? 0 : (inquiriesRes.count ?? 0);

    return {
      bookings: bookingsRes.error ? 0 : (bookingsRes.count ?? 0),
      inbox: unreadInbox + openInquiries,
    };
  } catch {
    return { bookings: 0, inbox: 0 };
  }
}

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/provider");
  if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const access = await getProviderForUser(session.user.id).catch(() => null);
  const approved =
    session.user.role === "ADMIN" || Boolean(access?.provider.isApproved);
  const membershipRole =
    session.user.role === "ADMIN" ? "OWNER" : access?.role || "FRONT_DESK";

  const businessName =
    (access?.provider.name as string | undefined)?.trim() || "Your business";
  const businessLogo =
    (access?.provider.logoUrl as string | null | undefined)?.trim() || "";

  const badges = access?.provider.id
    ? await loadNavBadges(access.provider.id)
    : undefined;

  const settings = await getPlatformSettings();
  const bindTab = boolSetting(settings, "security.bindSessionToTab");
  const suppliersEnabled = boolSetting(settings, "flags.suppliersEnabled");
  const staffingEnabled = boolSetting(settings, "flags.staffingEnabled");

  return (
    <div
      data-role="provider"
      className="flex min-h-dvh w-full flex-col md:h-dvh md:flex-row md:overflow-hidden"
    >
      <TabSessionGate enabled={bindTab}>
        <ProviderSidebar
          user={{ name: session.user.name, email: session.user.email }}
          brand={{
            name: businessName,
            logoUrl: businessLogo,
            logoText: brandInitials(businessName),
          }}
          badges={badges}
          membershipRole={membershipRole}
          businessType={
            (access?.provider.businessType as string | null | undefined) || null
          }
          suppliersEnabled={suppliersEnabled}
          staffingEnabled={staffingEnabled}
        />
        <div className="dash-shell min-w-0 flex-1 md:overflow-y-auto">
          <div
            aria-hidden
            className="h-1 w-full bg-gradient-to-r from-[#062824] via-[#178076] to-[#e0a41a]"
          />
          <ProviderShellHeader businessName={businessName} />
          <AnnouncementBanner />
          <ProviderApprovalGate
            approved={approved}
            businessName={access?.provider.name as string | undefined}
          >
            <ProviderRoleGate role={membershipRole}>{children}</ProviderRoleGate>
          </ProviderApprovalGate>
          <p className="px-4 py-3 text-center text-[0.7rem] text-ink-muted md:px-6">
            Powered by Safari Hub
          </p>
        </div>
      </TabSessionGate>
    </div>
  );
}
