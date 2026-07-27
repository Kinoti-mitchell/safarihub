import { db } from "@/lib/supabase";
import {
  computeFeatureWindow,
  type FeaturePeriod,
} from "@/lib/featured-shared";

export * from "@/lib/featured-shared";

/** Clear Features whose carousel window has ended. */
export async function expireDueFeatures(): Promise<void> {
  const now = new Date().toISOString();
  try {
    const { data: expired } = await db
      .from("Listing")
      .select("id")
      .eq("featured", true)
      .not("featuredEndsAt", "is", null)
      .lt("featuredEndsAt", now);

    for (const row of expired ?? []) {
      await db
        .from("Listing")
        .update({
          featured: false,
          featuredEndsAt: null,
          updatedAt: now,
        })
        .eq("id", row.id);
    }
  } catch (error) {
    console.error("expireDueFeatures failed", error);
  }
}

export async function applyFeature(
  listingId: string,
  period: FeaturePeriod,
): Promise<{ featuredAt: string; featuredEndsAt: string }> {
  const { featuredAt, featuredEndsAt } = computeFeatureWindow(period);
  const now = new Date().toISOString();
  const featuredAtIso = featuredAt.toISOString();
  const featuredEndsAtIso = featuredEndsAt.toISOString();

  const { error } = await db
    .from("Listing")
    .update({
      featured: true,
      featuredAt: featuredAtIso,
      featuredEndsAt: featuredEndsAtIso,
      updatedAt: now,
    })
    .eq("id", listingId);
  if (error) throw error;

  return { featuredAt: featuredAtIso, featuredEndsAt: featuredEndsAtIso };
}

export async function clearFeature(listingId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from("Listing")
    .update({
      featured: false,
      featuredEndsAt: null,
      updatedAt: now,
    })
    .eq("id", listingId);
  if (error) throw error;
}
