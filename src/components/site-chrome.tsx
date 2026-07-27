"use client";

import { usePathname } from "next/navigation";

const DASHBOARD_ROUTES = ["/admin", "/provider", "/account"];

export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = DASHBOARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return (
    <>
      {!isDashboard && header}
      <main className="flex-1">{children}</main>
      {!isDashboard && footer}
    </>
  );
}
