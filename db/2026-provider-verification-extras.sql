-- =============================================================================
-- Safari Hub — provider verification extras (OTP, terms, selfie, M-Pesa, expiry)
-- Run after 2026-provider-verification.sql. Safe to re-run.
-- =============================================================================

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "selfieDocUrl" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "mpesaTillOrPaybill" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "businessPermitExpiresAt" DATE;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "traLicenceExpiresAt" DATE;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "amenities" JSONB NOT NULL DEFAULT '[]';

-- One-time codes for phone / email verification at signup
CREATE TABLE IF NOT EXISTS "VerificationOtp" (
  "id" TEXT PRIMARY KEY,
  "channel" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "VerificationOtp_destination_idx"
  ON "VerificationOtp"("destination");
CREATE INDEX IF NOT EXISTS "VerificationOtp_expiresAt_idx"
  ON "VerificationOtp"("expiresAt");

-- Optional server-side signup drafts (also mirrored in browser localStorage)
CREATE TABLE IF NOT EXISTS "ProviderSignupDraft" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "step" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderSignupDraft_email_uidx"
  ON "ProviderSignupDraft"("email");
CREATE INDEX IF NOT EXISTS "ProviderSignupDraft_expiresAt_idx"
  ON "ProviderSignupDraft"("expiresAt");
