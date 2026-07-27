-- =============================================================================
-- Safari Hub — provider company logo + business terms
-- Safe to re-run.
-- =============================================================================

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
