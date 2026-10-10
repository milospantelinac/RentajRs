-- T129 part 2: hide and icon for attributes and their options, the public
-- listing switch, and the key facts per category (until now a fixed list per
-- category slug in frontend/utils/keyFacts.js, copied over here exactly).
ALTER TABLE "CategoryAttribute" ADD COLUMN "showOnListing" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CategoryAttribute" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CategoryAttribute" ADD COLUMN "icon" TEXT;
ALTER TABLE "AttributeOption" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttributeOption" ADD COLUMN "icon" TEXT;
ALTER TABLE "Category" ADD COLUMN "cardFactKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Category" ADD COLUMN "listingFactKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Category" AS c SET "cardFactKeys" = v.card, "listingFactKeys" = v.listing
FROM (VALUES
  ('stanovi', ARRAY['kapacitet_ljudi', 'broj_soba', 'kvadratura'], ARRAY['kapacitet_ljudi', 'broj_soba', 'broj_kreveta', 'sprat', 'kvadratura']),
  ('kuce-i-vikendice', ARRAY['kapacitet_ljudi', 'broj_soba', 'kvadratura'], ARRAY['kapacitet_ljudi', 'broj_soba', 'broj_kreveta', 'broj_kupatila', 'kvadratura']),
  ('sobe', ARRAY['kapacitet_ljudi', 'broj_soba', 'kvadratura'], ARRAY['kapacitet_ljudi', 'broj_kreveta', 'kupatilo', 'kvadratura']),
  ('sale-za-proslave', ARRAY['kapacitet_ljudi', 'tip_prostora', 'ketering'], ARRAY['kapacitet_ljudi', 'tip_prostora', 'ketering']),
  ('konferencijske-sale', ARRAY['kapacitet_ljudi', 'tip_prostora', 'ketering'], ARRAY['kapacitet_ljudi', 'tip_prostora', 'ketering']),
  ('igraonice', ARRAY['kapacitet_dece', 'uzrast_dece', 'kvadratura'], ARRAY['kapacitet_dece', 'uzrast_dece']),
  ('putnicka-vozila', ARRAY['broj_sedista', 'menjac', 'godina_proizvodnje'], ARRAY['broj_sedista', 'menjac', 'gorivo', 'godina_proizvodnje']),
  ('dostavna-vozila', ARRAY['nosivost', 'zapremina_tovarnog_prostora', 'godina_proizvodnje'], ARRAY['nosivost', 'zapremina_tovarnog_prostora', 'menjac', 'godina_proizvodnje']),
  ('magacini-i-skladista', ARRAY['povrsina', 'visina_prostora', 'tip_prostora'], ARRAY['povrsina', 'visina_prostora', 'tip_prostora']),
  ('gradjevinske-masine', ARRAY['tip_masine', 'snaga_motora', 'tezina_masine'], ARRAY['tip_masine', 'snaga_motora', 'tezina_masine', 'godina_proizvodnje'])
) AS v(slug, card, listing)
WHERE c."slug" = v.slug;
