import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { TabSessionGate } from "@/components/tab-session-gate";
import { brandFromSettings } from "@/lib/branding";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  const brand = await brandFromSettings();
  const settings = await getPlatformSettings();
  const bindTab = boolSetting(settings, "security.bindSessionToTab");

  return (
    <div
      data-role="admin"
      className="flex min-h-dvh w-full flex-col md:h-dvh md:flex-row md:overflow-hidden"
    >
      <TabSessionGate enabled={bindTab}>
        <AdminSidebar
          user={{ name: session.user.name, email: session.user.email }}
          brand={brand}
        />
        <div className="dash-shell min-w-0 flex-1 md:overflow-y-auto">
          <div
            aria-hidden
            className="h-1 w-full bg-gradient-to-r from-[#062824] via-[#178076] to-[#e0a41a]"
          />
          {children}
          <p className="px-4 py-3 text-center text-[0.7rem] text-ink-muted md:px-6">
            Powered by Safari Hub
          </p>
        </div>
      </TabSessionGate>
    </div>
  );
}
