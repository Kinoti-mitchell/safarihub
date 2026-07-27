-- =============================================================================
-- Safari Hub — 2026 feature upgrade
-- Adds: provider KYC columns, booking cancellation columns, Favorites,
--       Conversations + Messages (provider inbox), Notifications.
-- Safe to re-run (IF NOT EXISTS). Paste into Supabase SQL Editor and Run,
-- or it is already included at the end of safari-hub.sql for fresh installs.
-- =============================================================================

-- Provider KYC (register route already writes these — columns were missing)
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kycType" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kycDocUrl" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'PENDING';

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
  "senderRole" TEXT NOT NULL, -- 'TOURIST' | 'PROVIDER' | 'ADMIN'
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
