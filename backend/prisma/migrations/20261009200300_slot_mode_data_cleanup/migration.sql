-- T140: a listing shows only the terms and prices of the way it is booked now.
-- Switching used to leave the other way's rows behind, which the listing page
-- kept showing. A slot listing that never got a way saved is on working hours,
-- the wizard's default. Then the leftovers go: working hours, their prices and
-- special prices of every listing not on working hours, the defined slots of
-- every listing not on defined slots, and the date prices of slot listings.
-- Blocked dates stay. A listing without booking keeps the rows of the way it
-- was booked, for the day it is booked online again.
UPDATE "Listing"
SET "slotSubmode" = 'WORKING_HOURS'
WHERE "bookingModel" = 'PER_SLOT' AND "slotSubmode" IS NULL;

-- The unit follows the way, as the wizard sets it: the hour on working hours,
-- the slot on defined slots (a hall priced per guest stays so). Only where
-- the category allows that unit.
UPDATE "Listing" AS l
SET "priceUnit" = 'HOUR'
FROM "Category" AS c
WHERE l."categoryId" = c."id"
  AND l."bookingModel" = 'PER_SLOT' AND l."slotSubmode" = 'WORKING_HOURS' AND l."priceUnit" <> 'HOUR'
  AND 'HOUR'::"PriceUnit" = ANY(c."allowedPriceUnits");

UPDATE "Listing" AS l
SET "priceUnit" = 'SLOT'
FROM "Category" AS c
WHERE l."categoryId" = c."id"
  AND l."bookingModel" = 'PER_SLOT' AND l."slotSubmode" = 'DEFINED_SLOTS' AND l."priceUnit" NOT IN ('SLOT', 'GUEST')
  AND 'SLOT'::"PriceUnit" = ANY(c."allowedPriceUnits");

DELETE FROM "WorkingHours" AS w
USING "Listing" AS l
WHERE w."listingId" = l."id"
  AND NOT (l."bookingModel" IN ('PER_SLOT', 'NO_BOOKING') AND l."slotSubmode" = 'WORKING_HOURS');

DELETE FROM "HourlyPriceRange" AS h
USING "Listing" AS l
WHERE h."listingId" = l."id"
  AND NOT (l."bookingModel" IN ('PER_SLOT', 'NO_BOOKING') AND l."slotSubmode" = 'WORKING_HOURS');

DELETE FROM "SlotPriceOverride" AS o
USING "Listing" AS l
WHERE o."listingId" = l."id"
  AND NOT (l."bookingModel" IN ('PER_SLOT', 'NO_BOOKING') AND l."slotSubmode" = 'WORKING_HOURS');

DELETE FROM "DefinedSlot" AS s
USING "Listing" AS l
WHERE s."listingId" = l."id"
  AND NOT (l."bookingModel" IN ('PER_SLOT', 'NO_BOOKING') AND l."slotSubmode" = 'DEFINED_SLOTS');

DELETE FROM "DatePriceOverride" AS d
USING "Listing" AS l
WHERE d."listingId" = l."id" AND l."bookingModel" = 'PER_SLOT';

-- T121: a listing on defined slots shows "Od X RSD", the lowest price of its
-- slots ahead (0 with none, "Trenutno nema termina"), and keeps no duration,
-- gap or weekend price. The backend keeps the price current every hour.
UPDATE "Listing" AS l
SET "price" = COALESCE(
      (SELECT MIN(s."price") FROM "DefinedSlot" AS s
       WHERE s."listingId" = l."id" AND s."startsAt" > now() AND s."price" IS NOT NULL),
      0),
    "weekendPrice" = NULL,
    "minDuration" = NULL,
    "maxDuration" = NULL,
    "gapAfterMinutes" = NULL
WHERE l."bookingModel" = 'PER_SLOT' AND l."slotSubmode" = 'DEFINED_SLOTS';
