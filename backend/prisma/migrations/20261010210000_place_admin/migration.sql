-- T119: what a settlement is (seat, town, village) and its municipality, and
-- hiding a place or a part of a city from new choices (Administracija > Lokacije).
CREATE TYPE "PlaceKind" AS ENUM ('SEAT', 'TOWN', 'VILLAGE');

ALTER TABLE "City" ADD COLUMN "municipality" TEXT,
ADD COLUMN "kind" "PlaceKind" NOT NULL DEFAULT 'VILLAGE',
ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CityArea" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
