-- Dizajn 8: Serbian locative form of the city name, for headings like
-- "Oglasi u Beogradu". Nullable so existing rows stay valid until seeded.
ALTER TABLE "City" ADD COLUMN "nameLocative" TEXT;
