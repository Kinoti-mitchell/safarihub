-- =============================================================================
-- Safari Hub — ONE SQL FILE for Supabase
-- Dashboard → SQL Editor → New query → Paste all → Run
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT)
-- Includes 3 roles: ADMIN · TOURIST · PROVIDER (migrates older role enums)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
-- Roles are only: ADMIN (system owner), TOURIST (guest), PROVIDER (hotel/venue)
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'TOURIST', 'PROVIDER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- If an older DB still has GUEST / TRAVELER / PROVIDER_OWNER / etc, rebuild Role
DO $$
DECLARE
  needs_rebuild boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'Role'
      AND e.enumlabel IN (
        'GUEST', 'TRAVELER', 'PROVIDER_OWNER', 'PROVIDER_STAFF', 'ORG_ADMIN'
      )
  ) INTO needs_rebuild;

  IF NOT needs_rebuild THEN
    RETURN;
  END IF;

  DROP TYPE IF EXISTS "Role_new";
  CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'TOURIST', 'PROVIDER');

  IF to_regclass('public."User"') IS NOT NULL THEN
    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING (
      CASE "role"::text
        WHEN 'ADMIN' THEN 'ADMIN'
        WHEN 'TOURIST' THEN 'TOURIST'
        WHEN 'PROVIDER' THEN 'PROVIDER'
        WHEN 'PROVIDER_OWNER' THEN 'PROVIDER'
        WHEN 'PROVIDER_STAFF' THEN 'PROVIDER'
        WHEN 'TRAVELER' THEN 'TOURIST'
        WHEN 'GUEST' THEN 'TOURIST'
        WHEN 'ORG_ADMIN' THEN 'TOURIST'
        ELSE 'TOURIST'
      END
    );
    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "Role_new" USING "role"::"Role_new";
  END IF;

  IF to_regclass('public."ProviderMember"') IS NOT NULL THEN
    ALTER TABLE "ProviderMember" ALTER COLUMN "role" TYPE TEXT USING (
      CASE "role"::text
        WHEN 'ADMIN' THEN 'ADMIN'
        WHEN 'TOURIST' THEN 'TOURIST'
        WHEN 'PROVIDER' THEN 'PROVIDER'
        WHEN 'PROVIDER_OWNER' THEN 'PROVIDER'
        WHEN 'PROVIDER_STAFF' THEN 'PROVIDER'
        ELSE 'PROVIDER'
      END
    );
    ALTER TABLE "ProviderMember"
      ALTER COLUMN "role" TYPE "Role_new" USING "role"::"Role_new";
  END IF;

  IF to_regclass('public."StaffInvite"') IS NOT NULL THEN
    ALTER TABLE "StaffInvite" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "StaffInvite" ALTER COLUMN "role" TYPE TEXT USING (
      CASE "role"::text
        WHEN 'PROVIDER' THEN 'PROVIDER'
        WHEN 'PROVIDER_OWNER' THEN 'PROVIDER'
        WHEN 'PROVIDER_STAFF' THEN 'PROVIDER'
        ELSE 'PROVIDER'
      END
    );
    ALTER TABLE "StaffInvite"
      ALTER COLUMN "role" TYPE "Role_new" USING "role"::"Role_new";
  END IF;

  IF to_regclass('public."OrgMember"') IS NOT NULL THEN
    ALTER TABLE "OrgMember" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "OrgMember" ALTER COLUMN "role" TYPE TEXT USING (
      CASE "role"::text
        WHEN 'ADMIN' THEN 'ADMIN'
        WHEN 'TOURIST' THEN 'TOURIST'
        WHEN 'PROVIDER' THEN 'PROVIDER'
        ELSE 'TOURIST'
      END
    );
    ALTER TABLE "OrgMember"
      ALTER COLUMN "role" TYPE "Role_new" USING "role"::"Role_new";
  END IF;

  DROP TYPE "Role";
  ALTER TYPE "Role_new" RENAME TO "Role";

  IF to_regclass('public."User"') IS NOT NULL THEN
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'TOURIST'::"Role";
  END IF;
  IF to_regclass('public."StaffInvite"') IS NOT NULL THEN
    ALTER TABLE "StaffInvite" ALTER COLUMN "role" SET DEFAULT 'PROVIDER'::"Role";
  END IF;
  IF to_regclass('public."OrgMember"') IS NOT NULL THEN
    ALTER TABLE "OrgMember" ALTER COLUMN "role" SET DEFAULT 'TOURIST'::"Role";
  END IF;
END $$;


DO $$ BEGIN CREATE TYPE "ListingCategory" AS ENUM ('STAY','EAT','MOVE','EXPLORE','MEET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ListingStatus" AS ENUM ('DRAFT','PENDING_REVIEW','PUBLISHED','SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BookingStatus" AS ENUM ('PENDING','RESERVED','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethod" AS ENUM ('MPESA','CARD','CASH_ON_ARRIVAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','PAID','FAILED','REFUNDED','NOT_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PayoutStatus" AS ENUM ('PENDING','PROCESSING','PAID','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InquiryStatus" AS ENUM ('NEW','REPLIED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auth
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT,
  "passwordHash" TEXT,
  "image" TEXT,
  "role" "Role" NOT NULL DEFAULT 'TOURIST',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  UNIQUE ("provider", "providerAccountId")
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expires" TIMESTAMP(3) NOT NULL,
  UNIQUE ("identifier", "token")
);

-- Locations: Country → County → Town
CREATE TABLE IF NOT EXISTS "Country" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "code" TEXT NOT NULL UNIQUE,
  "isLive" BOOLEAN NOT NULL DEFAULT false,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "County" (
  "id" TEXT PRIMARY KEY,
  "countryId" TEXT NOT NULL REFERENCES "Country"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isLive" BOOLEAN NOT NULL DEFAULT false,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("countryId", "slug"),
  UNIQUE ("countryId", "name")
);

CREATE TABLE IF NOT EXISTS "Town" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "countyId" TEXT NOT NULL REFERENCES "County"("id") ON DELETE CASCADE,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  UNIQUE ("countyId", "slug")
);

-- Providers
CREATE TABLE IF NOT EXISTS "Provider" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "commissionRate" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ProviderMember" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" "Role" NOT NULL,
  UNIQUE ("providerId", "userId")
);

CREATE TABLE IF NOT EXISTS "StaffInvite" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'PROVIDER',
  "token" TEXT NOT NULL UNIQUE,
  "accepted" BOOLEAN NOT NULL DEFAULT false,
  "invitedById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("providerId", "email")
);

-- Listings
CREATE TABLE IF NOT EXISTS "Listing" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "countyId" TEXT NOT NULL REFERENCES "County"("id"),
  "townId" TEXT REFERENCES "Town"("id"),
  "category" "ListingCategory" NOT NULL DEFAULT 'STAY',
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "locationConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "isPromoted" BOOLEAN NOT NULL DEFAULT false,
  "acceptMpesa" BOOLEAN NOT NULL DEFAULT true,
  "acceptCard" BOOLEAN NOT NULL DEFAULT true,
  "acceptCashOnArrival" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("providerId", "slug")
);

-- Upgrade columns if tables already existed
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "commissionRate" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "featuredEndsAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "isPromoted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "locationConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "County" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "County" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Town" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Town" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "Media" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "alt" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "RoomType" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "basePrice" INTEGER NOT NULL,
  "maxGuests" INTEGER NOT NULL DEFAULT 2,
  "amenities" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "RoomAvailability" (
  "id" TEXT PRIMARY KEY,
  "roomTypeId" TEXT NOT NULL REFERENCES "RoomType"("id") ON DELETE CASCADE,
  "date" TIMESTAMP(3) NOT NULL,
  "available" INTEGER NOT NULL,
  "price" INTEGER,
  UNIQUE ("roomTypeId", "date")
);

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OrgMember" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" "Role" NOT NULL DEFAULT 'TOURIST',
  UNIQUE ("organizationId", "userId")
);

CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id"),
  "roomTypeId" TEXT REFERENCES "RoomType"("id"),
  "travelerId" TEXT NOT NULL REFERENCES "User"("id"),
  "organizationId" TEXT REFERENCES "Organization"("id"),
  "checkIn" TIMESTAMP(3) NOT NULL,
  "checkOut" TIMESTAMP(3) NOT NULL,
  "guests" INTEGER NOT NULL DEFAULT 1,
  "roomsBooked" INTEGER NOT NULL DEFAULT 1,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "totalAmount" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "providerRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Payout" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE CASCADE,
  "amount" INTEGER NOT NULL,
  "commission" INTEGER NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE CASCADE,
  "travelerId" TEXT NOT NULL REFERENCES "User"("id"),
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "reply" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT PRIMARY KEY,
  "countyId" TEXT REFERENCES "County"("id"),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "venue" TEXT,
  "imageUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LoyaltyAccount" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "points" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LoyaltyLedger" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TravelPackage" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "price" INTEGER NOT NULL,
  "days" INTEGER NOT NULL DEFAULT 1,
  "imageUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PackageItem" (
  "id" TEXT PRIMARY KEY,
  "packageId" TEXT NOT NULL REFERENCES "TravelPackage"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "details" TEXT
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT,
  "actorName" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Listing_countyId_idx" ON "Listing"("countyId");
CREATE INDEX IF NOT EXISTS "Listing_status_idx" ON "Listing"("status");
ALTER TABLE "Booking" ALTER COLUMN "travelerId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
CREATE INDEX IF NOT EXISTS "Media_listingId_idx" ON "Media"("listingId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- Storage bucket for listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Anyone can view listing images" ON storage.objects;
CREATE POLICY "Anyone can view listing images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "Authenticated upload listing images" ON storage.objects;
CREATE POLICY "Authenticated upload listing images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "Authenticated update listing images" ON storage.objects;
CREATE POLICY "Authenticated update listing images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "Authenticated delete listing images" ON storage.objects;
CREATE POLICY "Authenticated delete listing images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images');

-- =============================================================================
-- Seed: Kenya → counties → towns (with map coordinates)
-- Upgrade path if County existed without countryId
-- =============================================================================

ALTER TABLE "County" ADD COLUMN IF NOT EXISTS "countryId" TEXT;
ALTER TABLE "County" DROP CONSTRAINT IF EXISTS "County_name_key";
ALTER TABLE "County" DROP CONSTRAINT IF EXISTS "County_slug_key";
ALTER TABLE "Town" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Town" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "County" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "County" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

INSERT INTO "Country" ("id","name","slug","code","isLive","latitude","longitude","createdAt","updatedAt") VALUES
  ('country_kenya', 'Kenya', 'kenya', 'KE', true, -1.2921, 36.8219, NOW(), NOW()),
  ('country_uganda', 'Uganda', 'uganda', 'UG', false, 1.3733, 32.2903, NOW(), NOW()),
  ('country_tanzania', 'Tanzania', 'tanzania', 'TZ', false, -6.3690, 34.8888, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "isLive" = EXCLUDED."isLive",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";

UPDATE "County" SET "countryId" = 'country_kenya' WHERE "countryId" IS NULL;

-- Only add FK if missing (ignore errors)
DO $$ BEGIN
  ALTER TABLE "County" ALTER COLUMN "countryId" SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "County" ADD CONSTRAINT "County_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "County_countryId_slug_key" ON "County"("countryId", "slug");
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "County_countryId_name_key" ON "County"("countryId", "name");
EXCEPTION WHEN others THEN NULL; END $$;

-- Kenya locations (safe to re-run)
INSERT INTO "Country" ("id","name","slug","code","isLive","latitude","longitude","createdAt","updatedAt") VALUES
  ('country_kenya', 'Kenya', 'kenya', 'KE', true, -1.2921, 36.8219, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "isLive" = true,
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";

INSERT INTO "County" ("id","countryId","name","slug","isLive","latitude","longitude","createdAt","updatedAt") VALUES
  ('county_mombasa', 'country_kenya', 'Mombasa', 'mombasa', true, -4.0435, 39.6682, NOW(), NOW()),
  ('county_kwale', 'country_kenya', 'Kwale', 'kwale', true, -4.1737, 39.4521, NOW(), NOW()),
  ('county_kilifi', 'country_kenya', 'Kilifi', 'kilifi', true, -3.6305, 39.8499, NOW(), NOW()),
  ('county_tana-river', 'country_kenya', 'Tana River', 'tana-river', true, -1.4826, 40.0339, NOW(), NOW()),
  ('county_lamu', 'country_kenya', 'Lamu', 'lamu', true, -2.2717, 40.902, NOW(), NOW()),
  ('county_taita-taveta', 'country_kenya', 'Taita-Taveta', 'taita-taveta', true, -3.3869, 38.556, NOW(), NOW()),
  ('county_garissa', 'country_kenya', 'Garissa', 'garissa', true, -0.4532, 39.6461, NOW(), NOW()),
  ('county_wajir', 'country_kenya', 'Wajir', 'wajir', true, 1.7471, 40.0573, NOW(), NOW()),
  ('county_mandera', 'country_kenya', 'Mandera', 'mandera', true, 3.9373, 41.8569, NOW(), NOW()),
  ('county_marsabit', 'country_kenya', 'Marsabit', 'marsabit', true, 2.3284, 37.9899, NOW(), NOW()),
  ('county_isiolo', 'country_kenya', 'Isiolo', 'isiolo', true, 0.3556, 37.5833, NOW(), NOW()),
  ('county_meru', 'country_kenya', 'Meru', 'meru', true, 0.0515, 37.6456, NOW(), NOW()),
  ('county_tharaka-nithi', 'country_kenya', 'Tharaka-Nithi', 'tharaka-nithi', true, -0.296, 37.873, NOW(), NOW()),
  ('county_embu', 'country_kenya', 'Embu', 'embu', true, -0.539, 37.458, NOW(), NOW()),
  ('county_kitui', 'country_kenya', 'Kitui', 'kitui', true, -1.367, 38.01, NOW(), NOW()),
  ('county_machakos', 'country_kenya', 'Machakos', 'machakos', true, -1.5177, 37.2634, NOW(), NOW()),
  ('county_makueni', 'country_kenya', 'Makueni', 'makueni', true, -1.8039, 37.6243, NOW(), NOW()),
  ('county_nyandarua', 'country_kenya', 'Nyandarua', 'nyandarua', true, -0.232, 36.495, NOW(), NOW()),
  ('county_nyeri', 'country_kenya', 'Nyeri', 'nyeri', true, -0.4197, 36.9476, NOW(), NOW()),
  ('county_kirinyaga', 'country_kenya', 'Kirinyaga', 'kirinyaga', true, -0.6591, 37.3827, NOW(), NOW()),
  ('county_muranga', 'country_kenya', 'Murang''a', 'muranga', true, -0.783, 37.04, NOW(), NOW()),
  ('county_kiambu', 'country_kenya', 'Kiambu', 'kiambu', true, -1.1714, 36.8356, NOW(), NOW()),
  ('county_turkana', 'country_kenya', 'Turkana', 'turkana', true, 3.3122, 35.5658, NOW(), NOW()),
  ('county_west-pokot', 'country_kenya', 'West Pokot', 'west-pokot', true, 1.6219, 35.3981, NOW(), NOW()),
  ('county_samburu', 'country_kenya', 'Samburu', 'samburu', true, 1.215, 36.954, NOW(), NOW()),
  ('county_trans-nzoia', 'country_kenya', 'Trans Nzoia', 'trans-nzoia', true, 1.0567, 34.95, NOW(), NOW()),
  ('county_uasin-gishu', 'country_kenya', 'Uasin Gishu', 'uasin-gishu', true, 0.5143, 35.2698, NOW(), NOW()),
  ('county_elgeyo-marakwet', 'country_kenya', 'Elgeyo-Marakwet', 'elgeyo-marakwet', true, 0.804, 35.538, NOW(), NOW()),
  ('county_nandi', 'country_kenya', 'Nandi', 'nandi', true, 0.186, 35.12, NOW(), NOW()),
  ('county_baringo', 'country_kenya', 'Baringo', 'baringo', true, 0.4667, 35.9667, NOW(), NOW()),
  ('county_laikipia', 'country_kenya', 'Laikipia', 'laikipia', true, 0.205, 36.787, NOW(), NOW()),
  ('county_nakuru', 'country_kenya', 'Nakuru', 'nakuru', true, -0.3031, 36.08, NOW(), NOW()),
  ('county_narok', 'country_kenya', 'Narok', 'narok', true, -1.078, 35.86, NOW(), NOW()),
  ('county_kajiado', 'country_kenya', 'Kajiado', 'kajiado', true, -1.85, 36.78, NOW(), NOW()),
  ('county_kericho', 'country_kenya', 'Kericho', 'kericho', true, -0.3689, 35.2863, NOW(), NOW()),
  ('county_bomet', 'country_kenya', 'Bomet', 'bomet', true, -0.7813, 35.3416, NOW(), NOW()),
  ('county_kakamega', 'country_kenya', 'Kakamega', 'kakamega', true, 0.2827, 34.7519, NOW(), NOW()),
  ('county_vihiga', 'country_kenya', 'Vihiga', 'vihiga', true, 0.081, 34.722, NOW(), NOW()),
  ('county_bungoma', 'country_kenya', 'Bungoma', 'bungoma', true, 0.5635, 34.5606, NOW(), NOW()),
  ('county_busia', 'country_kenya', 'Busia', 'busia', true, 0.4608, 34.1115, NOW(), NOW()),
  ('county_siaya', 'country_kenya', 'Siaya', 'siaya', true, 0.0607, 34.2882, NOW(), NOW()),
  ('county_kisumu', 'country_kenya', 'Kisumu', 'kisumu', true, -0.0917, 34.768, NOW(), NOW()),
  ('county_homa-bay', 'country_kenya', 'Homa Bay', 'homa-bay', true, -0.5273, 34.4571, NOW(), NOW()),
  ('county_migori', 'country_kenya', 'Migori', 'migori', true, -1.0634, 34.4731, NOW(), NOW()),
  ('county_kisii', 'country_kenya', 'Kisii', 'kisii', true, -0.6817, 34.7667, NOW(), NOW()),
  ('county_nyamira', 'country_kenya', 'Nyamira', 'nyamira', true, -0.5633, 34.9358, NOW(), NOW()),
  ('county_nairobi', 'country_kenya', 'Nairobi', 'nairobi', true, -1.2921, 36.8219, NOW(), NOW())
ON CONFLICT ("countryId", "slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isLive" = true,
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";

INSERT INTO "Town" ("id", "name", "slug", "countyId", "latitude", "longitude")
SELECT
  left('town_' || v.county_slug || '_' || v.town_slug, 64),
  v.town_name,
  v.town_slug,
  c.id,
  v.lat,
  v.lng
FROM (VALUES
  ('mombasa', 'Mombasa', 'mombasa-town', -4.0435, 39.6682),  ('kwale', 'Kwale', 'kwale-town', -4.1737, 39.4521),  ('kilifi', 'Kilifi', 'kilifi-town', -3.6305, 39.8499),  ('tana-river', 'Hola', 'hola', -1.4826, 40.0339),  ('lamu', 'Lamu', 'lamu-town', -2.2717, 40.902),  ('taita-taveta', 'Wundanyi', 'wundanyi', -3.3869, 38.556),  ('garissa', 'Garissa', 'garissa-town', -0.4532, 39.6461),  ('wajir', 'Wajir', 'wajir-town', 1.7471, 40.0573),  ('mandera', 'Mandera', 'mandera-town', 3.9373, 41.8569),  ('marsabit', 'Marsabit', 'marsabit-town', 2.3284, 37.9899),  ('isiolo', 'Isiolo', 'isiolo-town', 0.3556, 37.5833),  ('meru', 'Meru', 'meru-town', 0.0515, 37.6456),  ('tharaka-nithi', 'Kathwana', 'kathwana', -0.296, 37.873),  ('embu', 'Embu', 'embu-town', -0.539, 37.458),  ('kitui', 'Kitui', 'kitui-town', -1.367, 38.01),  ('machakos', 'Machakos', 'machakos-town', -1.5177, 37.2634),  ('makueni', 'Wote', 'wote', -1.8039, 37.6243),  ('nyandarua', 'Ol Kalou', 'ol-kalou', -0.232, 36.495),  ('nyeri', 'Nyeri', 'nyeri-town', -0.4197, 36.9476),  ('kirinyaga', 'Kerugoya', 'kerugoya', -0.6591, 37.3827),  ('muranga', 'Murang''a', 'muranga-town', -0.783, 37.04),  ('kiambu', 'Kiambu', 'kiambu-town', -1.1714, 36.8356),  ('turkana', 'Lodwar', 'lodwar', 3.1191, 35.5973),  ('turkana', 'Kakuma', 'kakuma', 3.7172, 34.8606),  ('turkana', 'Kalokol', 'kalokol', 3.525, 35.85),  ('west-pokot', 'Kapenguria', 'kapenguria', 1.2389, 35.12),  ('samburu', 'Maralal', 'maralal', 1.0968, 36.698),  ('trans-nzoia', 'Kitale', 'kitale', 1.0157, 35.0062),  ('uasin-gishu', 'Eldoret', 'eldoret', 0.5143, 35.2698),  ('elgeyo-marakwet', 'Iten', 'iten', 0.6703, 35.5081),  ('nandi', 'Kapsabet', 'kapsabet', 0.202, 35.105),  ('baringo', 'Kabarnet', 'kabarnet', 0.4919, 35.743),  ('laikipia', 'Nanyuki', 'nanyuki', 0.0105, 37.0735),  ('nakuru', 'Nakuru', 'nakuru-town', -0.3031, 36.08),  ('narok', 'Narok', 'narok-town', -1.078, 35.86),  ('kajiado', 'Kajiado', 'kajiado-town', -1.85, 36.78),  ('kericho', 'Kericho', 'kericho-town', -0.3689, 35.2863),  ('bomet', 'Bomet', 'bomet-town', -0.7813, 35.3416),  ('kakamega', 'Kakamega', 'kakamega-town', 0.2827, 34.7519),  ('vihiga', 'Mbale', 'mbale', 0.081, 34.722),  ('bungoma', 'Bungoma', 'bungoma-town', 0.5635, 34.5606),  ('busia', 'Busia', 'busia-town', 0.4608, 34.1115),  ('siaya', 'Siaya', 'siaya-town', 0.0607, 34.2882),  ('kisumu', 'Kisumu', 'kisumu-town', -0.0917, 34.768),  ('homa-bay', 'Homa Bay', 'homa-bay-town', -0.5273, 34.4571),  ('migori', 'Migori', 'migori-town', -1.0634, 34.4731),  ('kisii', 'Kisii', 'kisii-town', -0.6817, 34.7667),  ('nyamira', 'Nyamira', 'nyamira-town', -0.5633, 34.9358),  ('nairobi', 'Nairobi CBD', 'nairobi-cbd', -1.2864, 36.8172),  ('nairobi', 'Westlands', 'westlands', -1.2673, 36.811),  ('nairobi', 'Eastleigh', 'eastleigh', -1.274, 36.848),  ('nairobi', 'Karen', 'karen', -1.3197, 36.7086)
) AS v(county_slug, town_name, town_slug, lat, lng)
JOIN "County" c
  ON c.slug = v.county_slug
 AND c."countryId" = 'country_kenya'
ON CONFLICT ("countyId", "slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";

-- Demo users
-- admin@safarihub.ke / admin123456
-- tourist@safarihub.ke / tourist123
INSERT INTO "User" ("id","name","email","passwordHash","role","createdAt","updatedAt") VALUES
  ('user_admin','Safari Hub Admin','admin@safarihub.ke','$2b$10$P3cnErWzfo5FN0KLMZNmuu73V4UBOqmTUt3kajBaGFsJQ5W/OEac.','ADMIN',NOW(),NOW()),
  ('user_tourist','Demo Tourist','tourist@safarihub.ke','$2b$10$taxlXSs.dZ92rfDmQjT9C.2v10vqXNt6GJBL7HYWOQkLOdYqb4ZKW','TOURIST',NOW(),NOW())
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role";

-- Legacy demo email → tourist
UPDATE "User" SET role = 'TOURIST' WHERE email = 'traveler@safarihub.ke';

-- Inquiries (tourist → provider leads)
CREATE TABLE IF NOT EXISTS "Inquiry" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "travelerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "message" TEXT NOT NULL,
  "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
  "reply" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Inquiry_providerId_status_idx" ON "Inquiry"("providerId", "status");
CREATE INDEX IF NOT EXISTS "Inquiry_listingId_idx" ON "Inquiry"("listingId");
CREATE INDEX IF NOT EXISTS "Listing_slug_idx" ON "Listing"("slug");

-- =============================================================================
-- Platform settings & role definitions
-- Built-in roles (ADMIN/TOURIST/PROVIDER) are seeded automatically by the app
-- (ensureRolesSeeded); no need to insert them here.
-- =============================================================================

-- Custom-role assignment on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleKey" TEXT;

-- Namespaced key/value store (e.g. "fees.defaultCommission")
CREATE TABLE IF NOT EXISTS "Setting" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Role definitions: built-in + custom roles, each with a permission array
CREATE TABLE IF NOT EXISTS "RoleDefinition" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "baseRole" "Role" NOT NULL DEFAULT 'TOURIST',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link User.roleKey → RoleDefinition.key (nullable; clears if a role is deleted)
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_roleKey_fkey"
    FOREIGN KEY ("roleKey") REFERENCES "RoleDefinition"("key") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "User_roleKey_idx" ON "User"("roleKey");

-- =============================================================================
-- 2026 feature upgrade — KYC, cancellations, favorites, inbox, notifications
-- (Also available standalone in db/2026-features.sql)
-- =============================================================================

-- Provider KYC (register route writes these)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kycType" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kycDocUrl" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- Unique identity (phone + company registration). National ID cross-user
-- uniqueness is enforced in the app so one owner can reuse their ID on
-- multiple of their own businesses.
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_unique"
  ON "User" ("phone")
  WHERE "phone" IS NOT NULL AND btrim("phone") <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "Provider_registrationNumber_unique"
  ON "Provider" ("registrationNumber")
  WHERE "registrationNumber" IS NOT NULL AND btrim("registrationNumber") <> '';

-- Booking cancellation trail
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;

-- Favorites / wishlist
CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "listingId")
);
CREATE INDEX IF NOT EXISTS "Favorite_userId_idx" ON "Favorite"("userId");
CREATE INDEX IF NOT EXISTS "Favorite_listingId_idx" ON "Favorite"("listingId");

-- Conversations: a per-listing thread between a tourist and a provider
CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "travelerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "guestPhone" TEXT,
  "subject" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unreadForProvider" INTEGER NOT NULL DEFAULT 0,
  "unreadForTraveler" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("listingId", "travelerId")
);
CREATE INDEX IF NOT EXISTS "Conversation_providerId_idx" ON "Conversation"("providerId");
CREATE INDEX IF NOT EXISTS "Conversation_travelerId_idx" ON "Conversation"("travelerId");
CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "senderId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "senderRole" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");

-- In-app notifications (bell)
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Password reset tokens (hashed; plain token is emailed once)
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- Stay types: overnight vs daytime (day-use)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "allowOvernight" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "allowDayUse" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "dayUsePrice" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stayType" TEXT NOT NULL DEFAULT 'OVERNIGHT';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "dayStartTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "dayEndTime" TEXT;

-- VAT + cash collection + receipts
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "subtotalAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "vatRate" INTEGER NOT NULL DEFAULT 16;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "vatAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "amountPaid" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidConfirmedById" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_receiptNumber_key" ON "Booking"("receiptNumber");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "amountReceived" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- Venue amenities + flexible offers (not rooms-only)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "amenities" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "offerKind" TEXT NOT NULL DEFAULT 'ROOM';

-- Place details (Google Maps-style: call, website, menu, hours)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "menuUrl" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "openingHours" TEXT;

-- Multi-category listings + free-form venue types (BnB, restaurant, …)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "categories" JSONB NOT NULL DEFAULT '["STAY"]';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "venueTypes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "listingKinds" JSONB NOT NULL DEFAULT '["PLACE"]';
UPDATE "Listing"
SET "categories" = jsonb_build_array("category"::text)
WHERE "categories" IS NULL
   OR "categories" = '[]'::jsonb
   OR "categories" = 'null'::jsonb;
UPDATE "Listing"
SET "listingKinds" = '["PLACE"]'::jsonb
WHERE "listingKinds" IS NULL
   OR "listingKinds" = '[]'::jsonb
   OR "listingKinds" = 'null'::jsonb;


-- Paid listing boosts (also in db/2026-boost.sql)

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
