-- =============================================================================
-- Safari Hub — provider business verification (KYC / KYB) for admin approval
-- Run in Supabase SQL Editor after 2026-hospitality-os.sql
-- Safe to re-run.
-- =============================================================================

-- Owner identity document (national ID image)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "ownerIdDocUrl" TEXT;

-- Company registration certificate scan
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "registrationCertUrl" TEXT;

-- County business permit / tourism licence (extra legitimacy)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "businessPermitUrl" TEXT;

-- Company contact (may differ from the owner's login email)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "companyEmail" TEXT;

-- Postal / physical address
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "postalAddress" TEXT;

-- Location (reuse County / Town catalogs)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "countyId" TEXT REFERENCES "County"("id") ON DELETE SET NULL;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "townId" TEXT REFERENCES "Town"("id") ON DELETE SET NULL;

-- Business classification
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "businessType" TEXT;

-- Operating schedule
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "operatingDays" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "opensAt" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "closesAt" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "establishedDate" DATE;

-- Premises geolocation (GPS)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Company website
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "website" TEXT;

-- Directors / officers (JSON array: [{name, idNumber?, role?}])
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "directors" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Extra supporting documents (JSON array of URLs)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "otherDocsUrls" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Who is registering this business (Owner, Manager, ICT, etc.)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "registrantRole" TEXT;

-- Scan / PDF of KRA PIN certificate
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kraPinDocUrl" TEXT;

CREATE INDEX IF NOT EXISTS "Provider_countyId_idx" ON "Provider"("countyId");
CREATE INDEX IF NOT EXISTS "Provider_businessType_idx" ON "Provider"("businessType");
CREATE INDEX IF NOT EXISTS "Provider_kraPin_idx" ON "Provider"("kraPin");
