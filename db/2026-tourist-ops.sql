-- Tourist ops: package M-Pesa payments, guest review tokens.
-- Run after 2026-tourist-essentials.sql and 2026-provider-ops.sql.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "packageBookingId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_packageBookingId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_packageBookingId_fkey"
      FOREIGN KEY ("packageBookingId") REFERENCES "PackageBooking"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Allow listing OR package payment rows
ALTER TABLE "Payment" ALTER COLUMN "bookingId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Payment_packageBookingId_idx"
  ON "Payment" ("packageBookingId");

ALTER TABLE "PackageBooking" ADD COLUMN IF NOT EXISTS "mpesaCheckoutId" TEXT;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_reviewToken_key"
  ON "Booking" ("reviewToken")
  WHERE "reviewToken" IS NOT NULL;

-- Guest reviews (no account): allow Review without a traveler User.
-- Guest identity comes from Booking.guestEmail / guestName via the booking row.
ALTER TABLE "Review" ALTER COLUMN "travelerId" DROP NOT NULL;
