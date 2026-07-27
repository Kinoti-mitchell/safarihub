-- Safari Hub — Provider-owned suppliers + business inventory (2026)
-- Run in Supabase SQL Editor after 2026-hospitality-os.sql

-- Private suppliers belong to a business; NULL providerId = platform marketplace
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "providerId" TEXT REFERENCES "Provider"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "Supplier_providerId_idx" ON "Supplier"("providerId");

-- Per-business stock (linen, F&B, cleaning, etc.) — not room capacity
CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "unit" TEXT NOT NULL DEFAULT 'unit',
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "reorderLevel" INTEGER NOT NULL DEFAULT 0,
  "unitCost" INTEGER NOT NULL DEFAULT 0,
  "supplierId" TEXT REFERENCES "Supplier"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "InventoryItem_providerId_idx" ON "InventoryItem"("providerId");
CREATE INDEX IF NOT EXISTS "InventoryItem_category_idx" ON "InventoryItem"("category");

CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL REFERENCES "InventoryItem"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'ADJUSTMENT',
  "notes" TEXT,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_providerId_idx" ON "InventoryMovement"("providerId");
