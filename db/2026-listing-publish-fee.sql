-- =============================================================================
-- Safari Hub — listing publish fee (pay to go live)
-- Admin approves the business once. Listings go live after publish payment
-- is verified (or immediately when publish fee is 0).
-- Safe to re-run.
-- =============================================================================

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishFeeKes" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishPaymentRef" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishPaymentNote" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishPaymentStatus" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishPaidAt" TIMESTAMP(3);

-- NONE | WAIVED | PENDING_VERIFY | PAID | REJECTED
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Listing_publishPaymentStatus_check'
  ) THEN
    ALTER TABLE "Listing"
      ADD CONSTRAINT "Listing_publishPaymentStatus_check"
      CHECK (
        "publishPaymentStatus" IS NULL
        OR "publishPaymentStatus" IN (
          'NONE', 'WAIVED', 'PENDING_VERIFY', 'PAID', 'REJECTED'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Listing_publishPaymentStatus_idx"
  ON "Listing"("publishPaymentStatus");

-- Turn off legacy per-listing content review (business approval + pay-to-publish instead).
INSERT INTO "Setting" ("id", "key", "value", "updatedAt")
VALUES (
  'setting_flags_requireListingApproval',
  'flags.requireListingApproval',
  'false',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET "value" = 'false', "updatedAt" = CURRENT_TIMESTAMP;

-- Default publish fee (admin can change in Settings → Listing publish fee).
INSERT INTO "Setting" ("id", "key", "value", "updatedAt")
VALUES (
  'setting_listing_publishFeeKes',
  'listing.publishFeeKes',
  '500',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
