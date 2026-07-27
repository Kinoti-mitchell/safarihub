import Link from "next/link";
import { brandFromSettings } from "@/lib/branding";

export async function SiteFooter() {
  const brand = await brandFromSettings();
  const about =
    brand.about ||
    `${brand.name} is a digital hospitality ecosystem — connecting travellers with operators for stays, dining, transport, events and experiences.`;

  return (
    <footer className="mt-auto border-t border-line/40 bg-lake text-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:px-6">
        <div>
          <p className="font-display text-2xl font-semibold">{brand.name}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-sand/75">
            {about}
          </p>
          <p className="mt-4 text-sm text-sand/80">
            Support:{" "}
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
            Discover
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/browse" className="text-sand/85 hover:text-sun-soft">
              Browse all
            </Link>
            <Link
              href="/destinations"
              className="text-sand/85 hover:text-sun-soft"
            >
              Destinations
            </Link>
            <Link
              href="/browse?category=stays"
              className="text-sand/85 hover:text-sun-soft"
            >
              Stays
            </Link>
            <Link
              href="/browse?category=explore"
              className="text-sand/85 hover:text-sun-soft"
            >
              Tours &amp; experiences
            </Link>
            <Link href="/packages" className="text-sand/85 hover:text-sun-soft">
              Packages
            </Link>
            <Link href="/events" className="text-sand/85 hover:text-sun-soft">
              Events
            </Link>
          </nav>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sand/55">
            Travellers
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link
              href="/legal/cancellation"
              className="text-sand/85 hover:text-sun-soft"
            >
              Cancellation
            </Link>
            <p className="text-sand/70">
              Emergency KE: 999 / 112
            </p>
          </nav>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sand/55">
            Company
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/legal/about" className="text-sand/85 hover:text-sun-soft">
              About
            </Link>
            <Link href="/legal/terms" className="text-sand/85 hover:text-sun-soft">
              Terms
            </Link>
            <Link
              href="/legal/privacy"
              className="text-sand/85 hover:text-sun-soft"
            >
              Privacy
            </Link>
            <Link
              href="/register?role=provider"
              className="text-sand/85 hover:text-sun-soft"
            >
              For operators
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-sand/15">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-sand/50 sm:px-6">
          © {new Date().getFullYear()} {brand.name}
          {brand.marketName
            ? ` · Built for ${brand.marketName}'s hospitality economy`
            : ""}
        </p>
      </div>
    </footer>
  );
}
