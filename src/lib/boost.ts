import { db } from "@/lib/supabase";
import {
  computeBoostWindow,
  type BoostPeriod,
} from "@/lib/boost-shared";

export * from "@/lib/boost-shared";

/** Clear promotions whose paid window has ended. */
export async function expireDueBoosts(): Promise<void> {
  const now = new Date().toISOString();
  try {
    const { data: expiredListings } = await db
      .from("Listing")
      .select("id")
      .eq("isPromoted", true)
      .not("boostEndsAt", "is", null)
      .lt("boostEndsAt", now);

    for (const row of expiredListings ?? []) {
      await db
        .from("Listing")
        .update({
          isPromoted: false,
          boostEndsAt: null,
          updatedAt: now,
        })
        .eq("id", row.id);
    }

    await db
      .from("BoostRequest")
      .update({ status: "EXPIRED", updatedAt: now })
      .eq("status", "ACTIVE")
      .lt("endsAt", now);
  } catch (error) {
    console.error("expireDueBoosts failed", error);
  }
}

export async function activateBoostOnListing(input: {
  listingId: string;
  period: BoostPeriod;
  startsAt?: Date;
}): Promise<{ startsAt: string; endsAt: string }> {
  const now = new Date();
  const { data: listing } = await db
    .from("Listing")
    .select("id, boostEndsAt")
    .eq("id", input.listingId)
    .maybeSingle();

  let from = input.startsAt ?? now;
  if (listing?.boostEndsAt) {
    const currentEnd = new Date(listing.boostEndsAt as string);
    if (currentEnd > from) from = currentEnd;
  }

  const { startsAt, endsAt } = computeBoostWindow(input.period, from);
  const startsIso = startsAt.toISOString();
  const endsIso = endsAt.toISOString();

  const { error } = await db
    .from("Listing")
    .update({
      isPromoted: true,
      boostEndsAt: endsIso,
      updatedAt: now.toISOString(),
    })
    .eq("id", input.listingId);
  if (error) throw error;

  return { startsAt: startsIso, endsAt: endsIso };
}

export async function clearListingBoost(listingId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from("Listing")
    .update({
      isPromoted: false,
      boostEndsAt: null,
      updatedAt: now,
    })
    .eq("id", listingId);
  if (error) throw error;
}
