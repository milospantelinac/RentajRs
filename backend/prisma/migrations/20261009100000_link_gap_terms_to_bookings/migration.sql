-- The gap after a booking (R70, "Razmak posle rezervacije") was saved without
-- the booking's id, so rejecting, cancelling or expiring the booking freed its
-- term but left the gap blocking the listing for good. New gaps carry the id.
-- This links the gaps that follow a live booking (same listing, the gap starts
-- where the booking ends) and frees every other one: those follow a booking
-- whose term was already released.
UPDATE "BlockedTerm" AS g
SET "bookingId" = b."id"
FROM "Booking" AS b
WHERE g."source" = 'GAP'
  AND g."bookingId" IS NULL
  AND b."listingId" = g."listingId"
  AND b."endsAt" = g."startsAt"
  AND b."status" IN ('REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED');

DELETE FROM "BlockedTerm" WHERE "source" = 'GAP' AND "bookingId" IS NULL;

-- Deleting an account cancelled its bookings without freeing their terms.
-- Every other way into these statuses frees them, so whatever is left here
-- came from a deleted account.
DELETE FROM "BlockedTerm" AS t
USING "Booking" AS b
WHERE t."bookingId" = b."id"
  AND b."status" IN ('REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW');
