import { auth } from "@/lib/auth";
import { brandFromSettings } from "@/lib/branding";
import { boolSetting, getPlatformSettings } from "@/lib/settings";

/**
 * When Admin enables maintenance mode, block the public site for non-admins.
 * /admin, /login, /api/auth, and /api/health stay reachable.
 */
export async function MaintenanceGate({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const settings = await getPlatformSettings();
  if (!boolSetting(settings, "general.maintenanceMode")) {
    return <>{children}</>;
  }

  const allowedPrefix = [
    "/admin",
    "/login",
    "/logout",
    "/api/auth",
    "/api/health",
    "/api/admin",
  ];
  if (allowedPrefix.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <>{children}</>;
  }

  const session = await auth();
  if (session?.user?.role === "ADMIN") {
    return <>{children}</>;
  }

  const brand = await brandFromSettings();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
        {brand.name}
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">
        We&apos;ll be right back
      </h1>
      <p className="mt-3 text-ink-muted">
        {brand.name} is undergoing scheduled maintenance. Please try again
        shortly.
        {brand.supportEmail ? (
          <>
            {" "}
            Questions?{" "}
            <a className="underline" href={`mailto:${brand.supportEmail}`}>
              {brand.supportEmail}
            </a>
          </>
        ) : null}
      </p>
      <p className="mt-8 text-sm text-ink-muted">
        <a className="underline" href="/login">
          Staff / admin sign in
        </a>
      </p>
    </div>
  );
}
