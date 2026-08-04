-- Provider ops: tour listing fields, provider-owned packages, departure capacity metadata.
-- Run in Supabase SQL editor after prior 2026 migrations.

-- Tour / experience fields on listings
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "durationHours" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "meetingPoint" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "inclusions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "exclusions" JSONB NOT NULL DEFAULT '[]';

-- Optional capacity unit label on offers (e.g. seats, vehicles)
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "capacityUnit" TEXT;

-- Provider-owned travel packages
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "meetingPoint" TEXT;
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "inclusions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "exclusions" JSONB NOT NULL DEFAULT '[]';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TravelPackage_providerId_fkey'
  ) THEN
    ALTER TABLE "TravelPackage"
      ADD CONSTRAINT "TravelPackage_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TravelPackage_providerId_idx"
  ON "TravelPackage" ("providerId");

-- Per-departure capacity overrides (extends RoomAvailability semantics for tours)
ALTER TABLE "RoomAvailability" ADD COLUMN IF NOT EXISTS "notes" TEXT;
