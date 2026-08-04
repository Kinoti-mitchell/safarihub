import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AccountSidebar } from "@/components/account-sidebar";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { TabSessionGate } from "@/components/tab-session-gate";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/account");

  const displayName =
    session.user.name?.trim() ||
    session.user.email?.split("@")[0] ||
    "My account";

  const settings = await getPlatformSettings();
  const bindTab = boolSetting(settings, "security.bindSessionToTab");

  return (
    <div
      data-role="tourist"
      className="flex min-h-dvh w-full flex-col md:h-dvh md:flex-row md:overflow-hidden"
    >
      <TabSessionGate enabled={bindTab}>
        <AccountSidebar
          user={{ name: session.user.name, email: session.user.email }}
          brand={{
            name: displayName,
            logoUrl: session.user.image || "",
            logoText: brandInitials(displayName),
          }}
        />
        <div className="dash-shell min-w-0 flex-1 md:overflow-y-auto">
          <div
            aria-hidden
            className="h-1 w-full bg-gradient-to-r from-[#062824] via-[#178076] to-[#e0a41a]"
          />
          <AnnouncementBanner />
          {children}
          <p className="px-4 py-3 text-center text-[0.7rem] text-ink-muted md:px-6">
            Powered by Safari Hub
          </p>
        </div>
      </TabSessionGate>
    </div>
  );
}
