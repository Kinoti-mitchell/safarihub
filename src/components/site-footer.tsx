import Link from "next/link";
import { cookies } from "next/headers";
import { brandFromSettings } from "@/lib/branding";
import { LOCALE_COOKIE } from "@/components/locale-toggle";
import { parseLocale, t } from "@/lib/i18n";

export async function SiteFooter() {
  const brand = await brandFromSettings();
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const about =
    brand.about ||
    t(locale, "defaultAbout", { name: brand.name });

  return (
    <footer className="mt-auto border-t border-line/40 bg-lake text-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:px-6">
        <div>
          <p className="font-display text-2xl font-semibold">{brand.name}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-sand/75">
            {about}
          </p>
          <p className="mt-4 text-sm text-sand/80">
            {t(locale, "support")}:{" "}
            <a
              href={`mailto:${brand.supportEmail}`}
              className="underline hover:text-sun-soft"
            >
              {brand.supportEmail}
            </a>
            {brand.supportPhone ? (
              <>
                <br />
                <a
                  href={`tel:${brand.supportPhone.replace(/\s+/g, "")}`}
                  className="underline hover:text-sun-soft"
                >
                  {brand.supportPhone}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sand/55">
            {t(locale, "discover")}
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/browse" className="text-sand/85 hover:text-sun-soft">
              {t(locale, "browseAllShort")}
            </Link>
            <Link
              href="/destinations"
              className="text-sand/85 hover:text-sun-soft"
            >
              {t(locale, "destinations")}
            </Link>
            <Link
              href="/browse?category=stays"
              className="text-sand/85 hover:text-sun-soft"
            >
              {t(locale, "catStays")}
            </Link>
            <Link
              href="/browse?category=explore"
              className="text-sand/85 hover:text-sun-soft"
            >
              {t(locale, "toursExperiences")}
            </Link>
            <Link href="/packages" className="text-sand/85 hover:text-sun-soft">
              {t(locale, "packages")}
            </Link>
            <Link href="/events" className="text-sand/85 hover:text-sun-soft">
              {t(locale, "events")}
            </Link>
          </nav>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sand/55">
            {t(locale, "travellers")}
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link
              href="/legal/cancellation"
              className="text-sand/85 hover:text-sun-soft"
            >
              {t(locale, "cancellation")}
            </Link>
            <p className="text-sand/70">{t(locale, "emergencyKe")}</p>
          </nav>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sand/55">
            {t(locale, "company")}
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/legal/about" className="text-sand/85 hover:text-sun-soft">
              {t(locale, "about")}
            </Link>
            <Link href="/legal/terms" className="text-sand/85 hover:text-sun-soft">
              {t(locale, "terms")}
            </Link>
            <Link
              href="/legal/privacy"
              className="text-sand/85 hover:text-sun-soft"
            >
              {t(locale, "privacy")}
            </Link>
            <Link
              href="/register?role=provider"
              className="text-sand/85 hover:text-sun-soft"
            >
              {t(locale, "forOperators")}
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-sand/15">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-sand/50 sm:px-6">
          © {new Date().getFullYear()} {brand.name}
          {brand.marketName
            ? ` · ${t(locale, "builtFor", { market: brand.marketName })}`
            : ""}
        </p>
      </div>
    </footer>
  );
}
