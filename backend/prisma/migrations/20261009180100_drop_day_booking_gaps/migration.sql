-- T117: a day booking ("Po danu", vehicles and machines) has no gap after it;
-- the pickup and return times do that job, and the return day is free for
-- the next pickup. The gaps those bookings left behind still block the
-- return day, so they go, and the listings stop asking for one.
DELETE FROM "BlockedTerm" AS t
USING "Listing" AS l
WHERE t."listingId" = l."id"
  AND t."source" = 'GAP'
  AND l."bookingModel" = 'PER_STAY'
  AND l."priceUnit" = 'DAY';

UPDATE "Listing"
SET "gapAfterMinutes" = NULL
WHERE "bookingModel" = 'PER_STAY'
  AND "priceUnit" = 'DAY'
  AND "gapAfterMinutes" IS NOT NULL;
