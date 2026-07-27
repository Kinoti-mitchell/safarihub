-- =============================================================================
-- Safari Hub — guest (no-account) booking + receipt access token
-- One-time tourists book with name/email/phone; members keep travelerId.
-- Safe to re-run.
-- =============================================================================

ALTER TABLE "Booking" ALTER COLUMN "travelerId" DROP NOT NULL;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_accessToken_uidx"
  ON "Booking"("accessToken")
  WHERE "accessToken" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Booking_guestEmail_idx" ON "Booking"("guestEmail");
