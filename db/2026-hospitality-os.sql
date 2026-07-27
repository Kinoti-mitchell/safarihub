-- Safari Hub — Hospitality Operating System (2026)
-- Run in Supabase SQL Editor after safari-hub.sql / 2026-features.sql
-- Aligns product with investor deck: staffing, suppliers, eTIMS queue, subscriptions.

-- Provider OS fields
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT NOT NULL DEFAULT 'STARTER';
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "payoutPhone" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kraPin" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "etimsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "acceptsBusinessTravel" BOOLEAN NOT NULL DEFAULT true;

-- Staff roles are provider-scoped TEXT (OWNER | MANAGER | FRONT_DESK | ACCOUNTANT)
-- ProviderMember.role / StaffInvite.role already TEXT in upgraded DBs.

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "description" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "countyId" TEXT REFERENCES "County"("id"),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SupplierOffer" (
  "id" TEXT PRIMARY KEY,
  "supplierId" TEXT NOT NULL REFERENCES "Supplier"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'unit',
  "unitPrice" INTEGER NOT NULL DEFAULT 0,
  "minQty" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SupplierOrder" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "supplierId" TEXT NOT NULL REFERENCES "Supplier"("id") ON DELETE CASCADE,
  "offerId" TEXT REFERENCES "SupplierOffer"("id") ON DELETE SET NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupplierOrder_providerId_idx" ON "SupplierOrder"("providerId");
CREATE INDEX IF NOT EXISTS "SupplierOrder_status_idx" ON "SupplierOrder"("status");

-- Fiscal / eTIMS submission queue (manual or API later)
CREATE TABLE IF NOT EXISTS "EtimsSubmission" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "bookingId" TEXT REFERENCES "Booking"("id") ON DELETE SET NULL,
  "receiptNumber" TEXT,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "vatAmount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "kraRef" TEXT,
  "errorMessage" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EtimsSubmission_providerId_idx" ON "EtimsSubmission"("providerId");
CREATE INDEX IF NOT EXISTS "EtimsSubmission_status_idx" ON "EtimsSubmission"("status");

-- Seed example suppliers (idempotent by slug)
INSERT INTO "Supplier" ("id", "name", "slug", "category", "description", "phone", "isActive")
VALUES
  ('sup_fresh_ke', 'Fresh Kenya Produce', 'fresh-kenya-produce', 'FOOD', 'Fresh fruit, vegetables and dairy for hotels and restaurants.', '+254700000101', true),
  ('sup_linen_ke', 'Highland Linen Co.', 'highland-linen', 'HOUSEKEEPING', 'Laundry, linen hire and room amenities for lodges.', '+254700000102', true),
  ('sup_security_ke', 'Northern Guard Services', 'northern-guard', 'SECURITY', 'Night security and gate staffing for hospitality venues.', '+254700000103', true)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "SupplierOffer" ("id", "supplierId", "title", "details", "unit", "unitPrice", "minQty", "isActive")
VALUES
  ('soff_veg_crate', 'sup_fresh_ke', 'Weekly vegetable crate', 'Assorted seasonal produce for kitchen prep.', 'crate', 4500, 1, true),
  ('soff_dairy_pack', 'sup_fresh_ke', 'Breakfast dairy pack', 'Milk, yoghurt and eggs for 20 covers.', 'pack', 3200, 1, true),
  ('soff_linen_week', 'sup_linen_ke', 'Linen hire — 20 rooms', 'Sheets, towels and pillowcases, weekly cycle.', 'week', 18000, 1, true),
  ('soff_guard_shift', 'sup_security_ke', 'Night guard shift', '12-hour security shift with radio.', 'shift', 2500, 1, true)
ON CONFLICT ("id") DO NOTHING;

-- Staff roles are provider-scoped TEXT (not global User Role enum)
ALTER TABLE "ProviderMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "ProviderMember" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

ALTER TABLE "StaffInvite" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "StaffInvite" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
ALTER TABLE "StaffInvite" ALTER COLUMN "role" SET DEFAULT 'FRONT_DESK';

