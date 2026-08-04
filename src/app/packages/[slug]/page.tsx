import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { brandFromSettings } from "@/lib/branding";
import { getPlatformSettings, numberSetting } from "@/lib/settings";
import { formatPriceTourist } from "@/lib/currency";
import { PackageBookClient } from "@/components/package-book-client";

type Props = { params: Promise<{ slug: string }> };

export default async function PackageDetailPage({ params }: Props) {
  const { slug } = await params;

  let pkg: Record<string, unknown> | null = null;
  const bySlug = await db
    .from("TravelPackage")
    .select("*, items:PackageItem(*)")
    .eq("slug", slug)
    .eq("isPublished", true)
    .maybeSingle();
  if (bySlug.data) pkg = bySlug.data as Record<string, unknown>;
  if (!pkg) {
    const byId = await db
      .from("TravelPackage")
      .select("*, items:PackageItem(*)")
      .eq("id", slug)
      .eq("isPublished", true)
      .maybeSingle();
    if (byId.data) pkg = byId.data as Record<string, unknown>;
  }
  if (!pkg) notFound();

  const [brand, settings] = await Promise.all([
    brandFromSettings(),
    getPlatformSettings(),
  ]);
  const price = formatPriceTourist(pkg.price as number, brand.currency);
  const priceLabel = price.approx
    ? `${price.primary} (${price.approx})`
    : price.primary;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/packages" className="text-sm text-lake-bright underline">
        ← Packages
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            {pkg.title as string}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {(pkg.days as number) || 1} day
            {(pkg.days as number) === 1 ? "" : "s"} · {priceLabel}
          </p>
          {pkg.description ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              {pkg.description as string}
            </p>
          ) : null}
          {Boolean(pkg.meetingPoint || pkg.capacity) && (
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {typeof pkg.meetingPoint === "string" && pkg.meetingPoint ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Meeting point</dt>
                  <dd className="font-medium text-ink">{pkg.meetingPoint}</dd>
                </div>
              ) : null}
              {typeof pkg.capacity === "number" && pkg.capacity > 0 ? (
                <div>
                  <dt className="text-ink-muted">Capacity</dt>
                  <dd className="font-medium text-ink">{pkg.capacity} seats</dd>
                </div>
              ) : null}
            </dl>
          )}
          {Array.isArray(pkg.inclusions) &&
            (pkg.inclusions as unknown[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink">Included</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                {(pkg.inclusions as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(pkg.exclusions) &&
            (pkg.exclusions as unknown[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink">Not included</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                {(pkg.exclusions as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="mt-6 space-y-3 text-sm text-ink">
            {(
              (pkg.items as Array<{
                id: string;
                label: string;
                details: string | null;
              }> | null) ?? []
            ).map((i) => (
              <li key={i.id} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-sun"
                />
                <span>
                  {i.label}
                  {i.details ? (
                    <span className="text-ink-muted"> — {i.details}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <PackageBookClient
          pkg={{
            id: pkg.id as string,
            slug: pkg.slug as string | undefined,
            title: pkg.title as string,
            description: (pkg.description as string | null) ?? null,
            price: pkg.price as number,
            days: (pkg.days as number) || 1,
            items:
              (pkg.items as Array<{
                id: string;
                label: string;
                details: string | null;
              }> | null) ?? null,
          }}
          priceLabel={priceLabel}
          trust={{
            supportEmail: brand.supportEmail,
            supportPhone: brand.supportPhone || undefined,
            cancellationHours: numberSetting(
              settings,
              "booking.cancellationWindowHours",
            ),
          }}
        />
      </div>
    </div>
  );
}
