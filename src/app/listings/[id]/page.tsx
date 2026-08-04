import type { Metadata } from "next";
import { Suspense } from "react";
import { findListingByIdOrSlug, publicListingPath } from "@/lib/listing";
import { brandFromSettings } from "@/lib/branding";
import { getPlatformSettings, numberSetting } from "@/lib/settings";
import { ListingDetailClient } from "./listing-detail-client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await findListingByIdOrSlug(id);
  if (!listing) return { title: "Listing" };

  const cover =
    listing.media.find((m) => m.isCover) || listing.media[0];
  const place = [listing.town?.name, listing.county.name]
    .filter(Boolean)
    .join(", ");
  const description =
    listing.description?.slice(0, 160) ||
    `${listing.title} in ${place} — book on Safari Hub`;

  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      type: "website",
      url: publicListingPath(listing),
      images: cover ? [{ url: cover.url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description,
      images: cover ? [cover.url] : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const [brand, settings] = await Promise.all([
    brandFromSettings(),
    getPlatformSettings(),
  ]);
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-ink-muted">
          Loading listing…
        </div>
      }
    >
      <ListingDetailClient
        params={params}
        trust={{
          supportEmail: brand.supportEmail,
          supportPhone: brand.supportPhone || undefined,
          cancellationHours: numberSetting(
            settings,
            "booking.cancellationWindowHours",
          ),
          displayCurrency: brand.currency,
          checkInTime: brand.checkInTime,
          checkOutTime: brand.checkOutTime,
        }}
      />
    </Suspense>
  );
}
