-- T126: "Po satu", a stay billed by the hour, is gone; vehicles are rented by
-- the day only. A listing still on it moves to the day. Its price stays the
-- number the owner typed (Tamara, 2026-10-09: no conversion), for the owner
-- to correct. A vehicle listed without booking can no longer be priced by the
-- hour either, since the hour leaves the vehicle categories below.
UPDATE "Listing" AS l
SET "priceUnit" = 'DAY'
FROM "Category" AS c
WHERE l."categoryId" = c."id"
  AND l."priceUnit" = 'HOUR'
  AND (l."bookingModel" = 'PER_STAY' OR c."slug" IN ('vozila', 'putnicka-vozila', 'dostavna-vozila'))
  AND 'DAY'::"PriceUnit" = ANY(c."allowedPriceUnits");

UPDATE "Category"
SET "allowedPriceUnits" = array_remove("allowedPriceUnits", 'HOUR'::"PriceUnit")
WHERE "slug" IN ('vozila', 'putnicka-vozila', 'dostavna-vozila');
