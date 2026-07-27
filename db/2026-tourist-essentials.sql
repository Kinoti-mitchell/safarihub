-- =============================================================================
-- Safari Hub — tourist essentials: package bookings (guest-capable)
-- Safe to re-run.
-- =============================================================================

ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "countyId" TEXT
  REFERENCES "County"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "PackageBooking" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE,
  "packageId" TEXT NOT NULL REFERENCES "TravelPackage"("id") ON DELETE RESTRICT,
  "travelerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "guestPhone" TEXT,
  "accessToken" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "guests" INTEGER NOT NULL DEFAULT 1,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "subtotalAmount" INTEGER NOT NULL,
  "vatRate" INTEGER NOT NULL DEFAULT 0,
  "vatAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "amountPaid" INTEGER,
  "paidAt" TIMESTAMP(3),
  "receiptNumber" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PackageBooking_accessToken_uidx"
  ON "PackageBooking"("accessToken")
  WHERE "accessToken" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PackageBooking_guestEmail_idx"
  ON "PackageBooking"("guestEmail");

CREATE INDEX IF NOT EXISTS "PackageBooking_packageId_idx"
  ON "PackageBooking"("packageId");
