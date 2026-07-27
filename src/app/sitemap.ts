import { MetadataRoute } from "next";
import { db } from "@/lib/supabase";
import { publicListingPath, publicProviderPath } from "@/lib/listing";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/browse",
    "/events",
    "/packages",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));

  try {
    const [listingsRes, providersRes] = await Promise.all([
      db
        .from("Listing")
        .select("id, slug, updatedAt, county:County!inner(isLive)")
        .eq("status", "PUBLISHED")
        .eq("county.isLive", true)
        .limit(500),
      db
        .from("Provider")
        .select("slug, updatedAt")
        .eq("isApproved", true)
        .limit(200),
    ]);
    const listings = (listingsRes.data ?? []) as Array<{
      id: string;
      slug: string;
      updatedAt: string;
    }>;
    const providers = (providersRes.data ?? []) as Array<{
      slug: string;
      updatedAt: string;
    }>;

    return [
      ...staticRoutes,
      ...listings.map((l) => ({
        url: `${base}${publicListingPath(l)}`,
        lastModified: new Date(l.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...providers.map((p) => ({
        url: `${base}${publicProviderPath(p)}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
