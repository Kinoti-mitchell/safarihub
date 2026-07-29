import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/rbac";
import { getPlatformSettings, boolSetting } from "@/lib/settings";
import { NavLink } from "@/components/nav-link";
import { NotificationBell } from "@/components/notification-bell";
import { LocaleToggle, LOCALE_COOKIE } from "@/components/locale-toggle";
import { parseLocale, t } from "@/lib/i18n";

export async function SiteHeader() {
  const session = await auth();
  const settings = await getPlatformSettings();
  const eventsEnabled = boolSetting(settings, "flags.eventsEnabled");
  const packagesEnabled = boolSetting(settings, "flags.packagesEnabled");
  const logoUrl = String(settings["branding.logoUrl"] || "");
  const logoText = String(settings["branding.logoText"] || "");
  const platformName =
    String(settings["general.platformName"] || "").trim() || "Platform";
  const marketName = String(settings["general.marketName"] || "").trim();
  const initials =
    logoText.trim() ||
    platformName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") ||
    "·";
  const dash = session?.user
    ? dashboardPathForRole(session.user.role)
    : "/login";
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={platformName}
              className="h-8 w-auto max-w-[10rem] object-contain"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-lake text-sm font-bold text-sand shadow-sm transition-transform group-hover:-rotate-6"
            >
              {initials.slice(0, 2)}
            </span>
          )}
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-display text-xl font-semibold tracking-tight text-lake sm:text-2xl">
              {platformName}
            </span>
            {marketName ? (
              <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-ink-muted sm:inline">
                {marketName}
              </span>
            ) : null}
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          <NavLink href="/browse">{t(locale, "browse")}</NavLink>
          <NavLink href="/destinations" className="hidden sm:inline-block">
            {t(locale, "destinations")}
          </NavLink>
          {eventsEnabled && (
            <NavLink href="/events" className="hidden sm:inline-block">
              {t(locale, "events")}
            </NavLink>
          )}
          {packagesEnabled && (
            <NavLink href="/packages">
              {t(locale, "packages")}
            </NavLink>
          )}
          <span className="hidden sm:inline-flex">
            <LocaleToggle initial={locale} />
          </span>
          {session?.user ? (
            <>
              <NotificationBell />
              <NavLink href={dash}>Dashboard</NavLink>
              <Link
                href="/logout"
                className="rounded-full bg-lake px-3.5 py-2 text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md"
              >
                Sign out
              </Link>
            </>
          ) : (
            <>
              <NavLink href="/login">Log in</NavLink>
              <Link
                href="/register"
                className="rounded-full bg-sun px-3.5 py-2 text-ink shadow-sm transition hover:brightness-110"
              >
                Join
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
