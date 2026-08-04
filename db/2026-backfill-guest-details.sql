-- Backfill guestName / guestEmail / guestPhone on existing bookings from the
-- linked traveler User when those columns were left null (member bookings
-- before checkout form details were always persisted).
-- Safe to re-run.

UPDATE "Booking" b
SET
  "guestName" = COALESCE(NULLIF(TRIM(b."guestName"), ''), u."name"),
  "guestEmail" = COALESCE(NULLIF(TRIM(b."guestEmail"), ''), LOWER(TRIM(u."email"))),
  "guestPhone" = COALESCE(NULLIF(TRIM(b."guestPhone"), ''), u."phone"),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" u
WHERE b."travelerId" = u."id"
  AND (
    b."guestName" IS NULL
    OR TRIM(b."guestName") = ''
    OR b."guestEmail" IS NULL
    OR TRIM(b."guestEmail") = ''
    OR (
      (b."guestPhone" IS NULL OR TRIM(b."guestPhone") = '')
      AND u."phone" IS NOT NULL
      AND TRIM(u."phone") <> ''
    )
  );

UPDATE "PackageBooking" pb
SET
  "guestName" = COALESCE(NULLIF(TRIM(pb."guestName"), ''), u."name"),
  "guestEmail" = COALESCE(NULLIF(TRIM(pb."guestEmail"), ''), LOWER(TRIM(u."email"))),
  "guestPhone" = COALESCE(NULLIF(TRIM(pb."guestPhone"), ''), u."phone"),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" u
WHERE pb."travelerId" = u."id"
  AND (
    pb."guestName" IS NULL
    OR TRIM(pb."guestName") = ''
    OR pb."guestEmail" IS NULL
    OR TRIM(pb."guestEmail") = ''
    OR (
      (pb."guestPhone" IS NULL OR TRIM(pb."guestPhone") = '')
      AND u."phone" IS NOT NULL
      AND TRIM(u."phone") <> ''
    )
  );
