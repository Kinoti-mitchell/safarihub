-- =============================================================================
-- Safari Hub — timed homepage / carousel Feature
-- Admin chooses how long a listing stays featured (carousel + featured row).
-- Safe to re-run.
-- =============================================================================

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "featuredEndsAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Listing_featured_idx" ON "Listing"("featured");
CREATE INDEX IF NOT EXISTS "Listing_featuredEndsAt_idx" ON "Listing"("featuredEndsAt");
CREATE INDEX IF NOT EXISTS "Listing_featuredAt_idx" ON "Listing"("featuredAt");

-- Backfill: currently featured listings get a start timestamp so "recent" order works.
UPDATE "Listing"
SET "featuredAt" = COALESCE("featuredAt", "updatedAt", "createdAt")
WHERE "featured" = true AND "featuredAt" IS NULL;
