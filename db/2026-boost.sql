-- =============================================================================
-- Safari Hub — paid listing boosts
-- Admin-priced periods (daily / weekly / monthly / yearly).
-- Providers request a boost after the listing is published; admin approves
-- after payment verification.
-- Safe to re-run.
-- =============================================================================

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "boostEndsAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "BoostPlan" (
  "id" TEXT PRIMARY KEY,
  "period" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "priceKes" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoostPlan_period_check"
    CHECK ("period" IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  CONSTRAINT "BoostPlan_price_check" CHECK ("priceKes" >= 0)
);

CREATE TABLE IF NOT EXISTS "BoostRequest" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "planId" TEXT NOT NULL REFERENCES "BoostPlan"("id") ON DELETE RESTRICT,
  "period" TEXT NOT NULL,
  "priceKes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "paymentRef" TEXT,
  "paymentNote" TEXT,
  "adminNote" TEXT,
  "requestedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "reviewedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "reviewedAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoostRequest_status_check"
    CHECK ("status" IN (
      'PENDING_APPROVAL',
      'ACTIVE',
      'REJECTED',
      'EXPIRED',
      'CANCELLED'
    )),
  CONSTRAINT "BoostRequest_period_check"
    CHECK ("period" IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'))
);

CREATE INDEX IF NOT EXISTS "BoostRequest_status_idx" ON "BoostRequest"("status");
CREATE INDEX IF NOT EXISTS "BoostRequest_listingId_idx" ON "BoostRequest"("listingId");
CREATE INDEX IF NOT EXISTS "BoostRequest_providerId_idx" ON "BoostRequest"("providerId");
CREATE INDEX IF NOT EXISTS "BoostRequest_createdAt_idx" ON "BoostRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "Listing_boostEndsAt_idx" ON "Listing"("boostEndsAt");

-- Default rates (admin can edit in console). Upsert by period.
INSERT INTO "BoostPlan" ("id", "period", "label", "priceKes", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('boost_plan_daily', 'DAILY', 'Daily boost', 500, true, 1, NOW(), NOW()),
  ('boost_plan_weekly', 'WEEKLY', 'Weekly boost', 2500, true, 2, NOW(), NOW()),
  ('boost_plan_monthly', 'MONTHLY', 'Monthly boost', 8000, true, 3, NOW(), NOW()),
  ('boost_plan_yearly', 'YEARLY', 'Yearly boost', 70000, true, 4, NOW(), NOW())
ON CONFLICT ("period") DO NOTHING;
