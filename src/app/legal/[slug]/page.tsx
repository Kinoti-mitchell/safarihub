import { getPlatformSettings } from "@/lib/settings";
import type { Metadata } from "next";
import Link from "next/link";

const PAGES = {
  about: {
    title: "About",
    key: "legal.about",
    fallback:
      "Safari Hub is Kenya's digital hospitality ecosystem — an operating system connecting hotels, restaurants, tours, transport and venues with travellers, suppliers, payments (M-Pesa) and compliance. Travellers book in one place; operators run the business.",
  },
  terms: {
    title: "Terms of service",
    key: "legal.terms",
    fallback:
      "By using Safari Hub you agree to book in good faith, pay as agreed, and follow house rules set by each provider.",
  },
  privacy: {
    title: "Privacy policy",
    key: "legal.privacy",
    fallback:
      "We collect account details, booking data, and payment references needed to run the marketplace. We do not store full card numbers.",
  },
  cancellation: {
    title: "Cancellation & refunds",
    key: "legal.cancellation",
    fallback:
      "Tourists may cancel free of charge before check-in / event start. Paid M-Pesa or card bookings are marked refunded in Safari Hub; actual money return follows your M-Pesa / card processor timeline. Cash-on-arrival reservations can be cancelled anytime before the visit.",
  },
} as const;

type Slug = keyof typeof PAGES;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  return { title: page?.title || "Legal" };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl text-lake">Not found</h1>
        <Link href="/" className="mt-4 inline-block text-lake-bright underline">
          Home
        </Link>
      </div>
    );
  }

  const settings = await getPlatformSettings();
  const body =
    String(settings[page.key] || "").trim() || page.fallback;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs uppercase tracking-wider text-ink-muted">
        Safari Hub
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold text-lake sm:text-4xl">
        {page.title}
      </h1>
      <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {body}
      </div>
      <nav className="mt-12 flex flex-wrap gap-4 border-t border-line pt-6 text-sm">
        {(Object.keys(PAGES) as Slug[]).map((s) => (
          <Link
            key={s}
            href={`/legal/${s}`}
            className={
              s === slug
                ? "font-semibold text-lake"
                : "text-ink-muted underline hover:text-lake"
            }
          >
            {PAGES[s].title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
