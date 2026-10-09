-- T138: a party hall (Sale za proslave) is booked by its defined slots only,
-- priced per slot or per guest. Halls on working hours move to defined slots
-- the way T140's switch moves a listing: their working hours, prices per part
-- of the day and special prices go, their blocked dates stay, the hour becomes
-- the slot (per guest stays per guest), and the rules a slot doesn't use are
-- cleared. Until the owner adds slots the listing says there are none.
DELETE FROM "WorkingHours" AS w
USING "Listing" AS l, "Category" AS c
WHERE w."listingId" = l."id" AND l."categoryId" = c."id" AND c."slug" = 'sale-za-proslave';

DELETE FROM "HourlyPriceRange" AS h
USING "Listing" AS l, "Category" AS c
WHERE h."listingId" = l."id" AND l."categoryId" = c."id" AND c."slug" = 'sale-za-proslave';

DELETE FROM "SlotPriceOverride" AS o
USING "Listing" AS l, "Category" AS c
WHERE o."listingId" = l."id" AND l."categoryId" = c."id" AND c."slug" = 'sale-za-proslave';

UPDATE "Listing" AS l
SET "slotSubmode" = 'DEFINED_SLOTS',
    "priceUnit" = CASE WHEN l."priceUnit" = 'GUEST' THEN 'GUEST'::"PriceUnit" ELSE 'SLOT'::"PriceUnit" END,
    "weekendPrice" = NULL,
    "minDuration" = NULL,
    "maxDuration" = NULL,
    "gapAfterMinutes" = NULL
FROM "Category" AS c
WHERE l."categoryId" = c."id" AND c."slug" = 'sale-za-proslave';

UPDATE "Category"
SET "allowedPriceUnits" = array_remove("allowedPriceUnits", 'HOUR'::"PriceUnit")
WHERE "slug" = 'sale-za-proslave';
