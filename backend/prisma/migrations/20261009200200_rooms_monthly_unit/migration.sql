-- T118: a room (Sobe) can be priced by the month too, as flats and houses are.
UPDATE "Category"
SET "allowedPriceUnits" = array_append("allowedPriceUnits", 'MONTH'::"PriceUnit")
WHERE "slug" = 'sobe' AND NOT ('MONTH'::"PriceUnit" = ANY("allowedPriceUnits"));
