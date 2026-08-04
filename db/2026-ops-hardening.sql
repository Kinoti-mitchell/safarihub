-- Ops hardening: refunds, payment events, disputes, booking support,
-- payout holds, trips, KYC rejection codes, eTIMS retries.
-- Safe to re-run.

-- ── Payout hold status ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PayoutStatus' AND e.enumlabel = 'ON_HOLD'
  ) THEN
    ALTER TYPE "PayoutStatus" ADD VALUE 'ON_HOLD';
  END IF;
END $$;

ALTER TABLE "Payout"
  ADD COLUMN IF NOT EXISTS "b2cConversationId" TEXT,
  ADD COLUMN IF NOT EXISTS "b2cOriginatorConversationId" TEXT,
  ADD COLUMN IF NOT EXISTS "b2cResultCode" TEXT,
  ADD COLUMN IF NOT EXISTS "b2cResultDesc" TEXT,
  ADD COLUMN IF NOT EXISTS "holdReason" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- ── KYC structured reject codes ───────────────────────────────────
ALTER TABLE "Provider"
  ADD COLUMN IF NOT EXISTS "rejectionCodes" JSONB;

-- ── Conversation ↔ booking support ────────────────────────────────
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "bookingId" TEXT REFERENCES "Booking"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'LISTING';

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_bookingId_uidx"
  ON "Conversation"("bookingId")
  WHERE "bookingId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Conversation_bookingId_idx"
  ON "Conversation"("bookingId");

-- ── Payment event audit trail ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT REFERENCES "Payment"("id") ON DELETE SET NULL,
  "bookingId" TEXT REFERENCES "Booking"("id") ON DELETE SET NULL,
  "packageBookingId" TEXT,
  "payoutId" TEXT REFERENCES "Payout"("id") ON DELETE SET NULL,
  "kind" TEXT NOT NULL,
  "providerRef" TEXT,
  "amount" DOUBLE PRECISION,
  "status" TEXT,
  "note" TEXT,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PaymentEvent_bookingId_idx" ON "PaymentEvent"("bookingId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_kind_idx" ON "PaymentEvent"("kind");
CREATE INDEX IF NOT EXISTS "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");

-- ── Refunds (M-Pesa reversal + manual) ────────────────────────────
CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT REFERENCES "Payment"("id") ON DELETE SET NULL,
  "bookingId" TEXT REFERENCES "Booking"("id") ON DELETE SET NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "mpesaReceipt" TEXT,
  "conversationId" TEXT,
  "originatorConversationId" TEXT,
  "errorMessage" TEXT,
  "note" TEXT,
  "requestedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Refund_bookingId_idx" ON "Refund"("bookingId");
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");

-- ── Disputes / no-show money hold ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "Dispute" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "Provider"("id") ON DELETE CASCADE,
  "openedById" TEXT,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "guestClaim" TEXT,
  "providerClaim" TEXT,
  "resolutionNote" TEXT,
  "refundAmount" DOUBLE PRECISION,
  "holdPayout" BOOLEAN NOT NULL DEFAULT TRUE,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Dispute_providerId_idx" ON "Dispute"("providerId");
CREATE INDEX IF NOT EXISTS "Dispute_status_idx" ON "Dispute"("status");

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "noShowAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "noShowById" TEXT,
  ADD COLUMN IF NOT EXISTS "noShowNote" TEXT;

-- ── Server trip planner ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Trip" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
  "shareToken" TEXT UNIQUE,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Trip_userId_idx" ON "Trip"("userId");

CREATE TABLE IF NOT EXISTS "TripStop" (
  "id" TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "listingId" TEXT REFERENCES "Listing"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "href" TEXT,
  "kind" TEXT,
  "checkIn" TEXT,
  "checkOut" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TripStop_tripId_idx" ON "TripStop"("tripId");

-- ── eTIMS hardening ───────────────────────────────────────────────
ALTER TABLE "EtimsSubmission"
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "packageBookingId" TEXT,
  ADD COLUMN IF NOT EXISTS "rawRequest" JSONB,
  ADD COLUMN IF NOT EXISTS "rawResponse" JSONB,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "EtimsSubmission_idempotencyKey_uidx"
  ON "EtimsSubmission"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
