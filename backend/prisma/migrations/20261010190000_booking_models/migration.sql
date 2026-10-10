-- T129 parts 3 and 4: the booking models as data, and which ones each
-- category offers. Each category gets exactly what it offered before: a stay
-- category its stay units, Sale za proslave defined slots only (T138),
-- Konferencijske sale working hours only (their defined slots failed on
-- save), the others both, and every category "Samo kontakt". "Po radnom
-- vremenu po gostu" goes to no category until the admin gives it one.
CREATE TABLE "BookingModelSetting" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priceUnits" "PriceUnit"[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingModelSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "CategoryBookingModel" (
    "categoryId" UUID NOT NULL,
    "modelKey" TEXT NOT NULL,
    CONSTRAINT "CategoryBookingModel_pkey" PRIMARY KEY ("categoryId", "modelKey")
);

ALTER TABLE "CategoryBookingModel" ADD CONSTRAINT "CategoryBookingModel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryBookingModel" ADD CONSTRAINT "CategoryBookingModel_modelKey_fkey" FOREIGN KEY ("modelKey") REFERENCES "BookingModelSetting"("key") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BookingModelSetting" ("key", "name", "description", "priceUnits", "displayOrder") VALUES
  ('DEFINED_SLOTS', 'Po terminu', 'Sami zadajete tačne termine (na primer 10:00-12:00 i 12:30-14:30). Gost bira samo iz te liste.', ARRAY['SLOT', 'GUEST']::"PriceUnit"[], 0),
  ('WORKING_HOURS', 'Po radnom vremenu po satu', 'Unosite radno vreme i dostupne dane, a gost bira termin unutar tog vremena.', ARRAY['HOUR']::"PriceUnit"[], 1),
  ('WORKING_HOURS_GUEST', 'Po radnom vremenu po gostu', 'Unosite radno vreme i dostupne dane, a gost dolazi kad želi u tom vremenu i plaća po osobi.', ARRAY['GUEST']::"PriceUnit"[], 2),
  ('DAY', 'Po danu', 'Gost bira prvi i poslednji dan, a cena se računa po danu.', ARRAY['DAY']::"PriceUnit"[], 3),
  ('NIGHT', 'Po noći', 'Gost bira datum dolaska i odlaska, a cena se računa po noći.', ARRAY['NIGHT']::"PriceUnit"[], 4),
  ('MONTH', 'Po mesecu', 'Gost bira mesec početka i broj meseci, a cena se računa po mesecu.', ARRAY['MONTH']::"PriceUnit"[], 5),
  ('CONTACT', 'Samo kontakt', 'Oglas nema kalendar ni zahteve. Gost vidi kontakt i dogovara se direktno sa vama.', ARRAY[]::"PriceUnit"[], 6);

INSERT INTO "CategoryBookingModel" ("categoryId", "modelKey")
SELECT c."id", m."key"
FROM "Category" c
CROSS JOIN "BookingModelSetting" m
WHERE m."key" = 'CONTACT'
   OR (c."defaultBookingModel" = 'PER_STAY' AND m."key" IN ('DAY', 'NIGHT', 'MONTH') AND m."key"::"PriceUnit" = ANY(c."allowedPriceUnits"))
   OR (c."defaultBookingModel" = 'PER_SLOT' AND m."key" = 'DEFINED_SLOTS' AND 'SLOT' = ANY(c."allowedPriceUnits") AND c."slug" <> 'konferencijske-sale')
   OR (c."defaultBookingModel" = 'PER_SLOT' AND m."key" = 'WORKING_HOURS' AND 'HOUR' = ANY(c."allowedPriceUnits") AND c."slug" <> 'sale-za-proslave');
