-- T115: the search filters 1:1 with Tamara's table (Trello T115), written
-- the way the seed writes them on a new database (search-filters.seed-data.ts).
-- Every statement can run twice without doing anything the second time.

-- 1. Each category's filters: the bar, then "Više filtera", in order.
INSERT INTO "CategoryFilter" ("id", "categoryId", "key", "attributeKey", "optionKey", "placement", "control", "thresholds", "displayOrder")
SELECT gen_random_uuid(), c."id", f."key", f."attributeKey", f."optionKey",
       f."placement"::"FilterPlacement", f."control"::"FilterControl", f."thresholds", f."displayOrder"
FROM (VALUES
  ('nekretnine', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[2, 4, 6, 8, 10, 20, 50]::INTEGER[], 0),
  ('nekretnine', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 1),
  ('nekretnine', 'kvadratura', 'kvadratura', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 2),
  ('nekretnine', 'broj_kreveta', 'broj_kreveta', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 3),
  ('nekretnine', 'broj_kupatila', 'broj_kupatila', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 4),
  ('nekretnine', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 5),
  ('nekretnine', 'ljubimci', 'sadrzaji', 'kucni-ljubimci-dozvoljeni', 'PANEL', 'OPTION_TOGGLE', ARRAY[]::INTEGER[], 6),
  ('stanovi', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[2, 4, 6, 8, 10, 20, 50]::INTEGER[], 0),
  ('stanovi', 'broj_soba', 'broj_soba', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('stanovi', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 2),
  ('stanovi', 'sprat', 'sprat', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 3),
  ('stanovi', 'kvadratura', 'kvadratura', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 4),
  ('stanovi', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 5),
  ('stanovi', 'ljubimci', 'sadrzaji', 'kucni-ljubimci-dozvoljeni', 'PANEL', 'OPTION_TOGGLE', ARRAY[]::INTEGER[], 6),
  ('kuce-i-vikendice', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[2, 4, 6, 8, 10, 20, 50]::INTEGER[], 0),
  ('kuce-i-vikendice', 'broj_soba', 'broj_soba', NULL, 'BAR', 'MIN', ARRAY[1, 2, 3, 4, 5]::INTEGER[], 1),
  ('kuce-i-vikendice', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 2),
  ('kuce-i-vikendice', 'broj_kreveta', 'broj_kreveta', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 3),
  ('kuce-i-vikendice', 'broj_kupatila', 'broj_kupatila', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 4),
  ('kuce-i-vikendice', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 5),
  ('kuce-i-vikendice', 'ljubimci', 'sadrzaji', 'kucni-ljubimci-dozvoljeni', 'PANEL', 'OPTION_TOGGLE', ARRAY[]::INTEGER[], 6),
  ('sobe', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[2, 4, 6, 8, 10, 20, 50]::INTEGER[], 0),
  ('sobe', 'kupatilo', 'kupatilo', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('sobe', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 2),
  ('sobe', 'broj_kreveta', 'broj_kreveta', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 3),
  ('sobe', 'kvadratura', 'kvadratura', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 4),
  ('sobe', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 5),
  ('sobe', 'ljubimci', 'sadrzaji', 'kucni-ljubimci-dozvoljeni', 'PANEL', 'OPTION_TOGGLE', ARRAY[]::INTEGER[], 6),
  ('prostori-za-proslave', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[20, 50, 100, 200, 300]::INTEGER[], 0),
  ('prostori-za-proslave', 'tip_prostora', 'tip_prostora', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('prostori-za-proslave', 'ketering', 'ketering', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 2),
  ('prostori-za-proslave', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 3),
  ('prostori-za-proslave', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 4),
  ('sale-za-proslave', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[20, 50, 100, 200, 300]::INTEGER[], 0),
  ('sale-za-proslave', 'tip_prostora', 'tip_prostora', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('sale-za-proslave', 'ketering', 'ketering', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 2),
  ('sale-za-proslave', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 3),
  ('sale-za-proslave', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 4),
  ('konferencijske-sale', 'guests', 'kapacitet_ljudi', NULL, 'BAR', 'GUESTS', ARRAY[20, 50, 100, 200, 300]::INTEGER[], 0),
  ('konferencijske-sale', 'tip_prostora', 'tip_prostora', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('konferencijske-sale', 'ketering', 'ketering', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 2),
  ('konferencijske-sale', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 3),
  ('konferencijske-sale', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 4),
  ('igraonice', 'guests', 'kapacitet_dece', NULL, 'BAR', 'GUESTS', ARRAY[10, 20, 30, 50]::INTEGER[], 0),
  ('igraonice', 'uzrast_dece', 'uzrast_dece', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('igraonice', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 2),
  ('igraonice', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 3),
  ('vozila', 'tip_vozila', 'tip_vozila', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 0),
  ('vozila', 'menjac', 'menjac', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('vozila', 'gorivo', 'gorivo', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 2),
  ('vozila', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 3),
  ('vozila', 'marka_vozila', 'marka_vozila', NULL, 'PANEL', 'MULTI_SELECT', ARRAY[]::INTEGER[], 4),
  ('vozila', 'godina_proizvodnje', 'godina_proizvodnje', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 5),
  ('vozila', 'oprema', 'oprema', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 6),
  ('putnicka-vozila', 'tip_vozila', 'tip_vozila', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 0),
  ('putnicka-vozila', 'broj_sedista', 'broj_sedista', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('putnicka-vozila', 'menjac', 'menjac', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 2),
  ('putnicka-vozila', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 3),
  ('putnicka-vozila', 'gorivo', 'gorivo', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 4),
  ('putnicka-vozila', 'marka_vozila', 'marka_vozila', NULL, 'PANEL', 'MULTI_SELECT', ARRAY[]::INTEGER[], 5),
  ('putnicka-vozila', 'pogon', 'pogon', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 6),
  ('putnicka-vozila', 'godina_proizvodnje', 'godina_proizvodnje', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 7),
  ('putnicka-vozila', 'oprema', 'oprema', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 8),
  ('putnicka-vozila', 'dostava_na_adresu', 'dostava_na_adresu', NULL, 'PANEL', 'TOGGLE', ARRAY[]::INTEGER[], 9),
  ('dostavna-vozila', 'tip_vozila', 'tip_vozila', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 0),
  ('dostavna-vozila', 'nosivost', 'nosivost', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('dostavna-vozila', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 2),
  ('dostavna-vozila', 'zapremina_tovarnog_prostora', 'zapremina_tovarnog_prostora', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 3),
  ('dostavna-vozila', 'duzina_tovarnog_prostora', 'duzina_tovarnog_prostora', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 4),
  ('dostavna-vozila', 'sirina_tovarnog_prostora', 'sirina_tovarnog_prostora', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 5),
  ('dostavna-vozila', 'visina_tovarnog_prostora', 'visina_tovarnog_prostora', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 6),
  ('dostavna-vozila', 'marka_vozila', 'marka_vozila', NULL, 'PANEL', 'MULTI_SELECT', ARRAY[]::INTEGER[], 7),
  ('dostavna-vozila', 'menjac', 'menjac', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 8),
  ('dostavna-vozila', 'gorivo', 'gorivo', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 9),
  ('dostavna-vozila', 'pogon', 'pogon', NULL, 'PANEL', 'SELECT', ARRAY[]::INTEGER[], 10),
  ('dostavna-vozila', 'godina_proizvodnje', 'godina_proizvodnje', NULL, 'PANEL', 'RANGE', ARRAY[]::INTEGER[], 11),
  ('dostavna-vozila', 'oprema', 'oprema', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 12),
  ('dostavna-vozila', 'dostava_na_adresu', 'dostava_na_adresu', NULL, 'PANEL', 'TOGGLE', ARRAY[]::INTEGER[], 13),
  ('magacini-i-skladista', 'povrsina', 'povrsina', NULL, 'BAR', 'MIN', ARRAY[20, 50, 100, 200, 500]::INTEGER[], 0),
  ('magacini-i-skladista', 'tip_prostora', 'tip_prostora', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 1),
  ('magacini-i-skladista', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 2),
  ('magacini-i-skladista', 'sadrzaji', 'sadrzaji', NULL, 'PANEL', 'ALL_OF', ARRAY[]::INTEGER[], 3),
  ('gradjevinske-masine', 'tip_masine', 'tip_masine', NULL, 'BAR', 'SELECT', ARRAY[]::INTEGER[], 0),
  ('gradjevinske-masine', 'sa_rukovaocem', 'sa_rukovaocem', NULL, 'BAR', 'TOGGLE', ARRAY[]::INTEGER[], 1),
  ('gradjevinske-masine', 'dostava_na_lokaciju', 'dostava_na_lokaciju', NULL, 'BAR', 'TOGGLE', ARRAY[]::INTEGER[], 2),
  ('ostalo', 'area', NULL, NULL, 'BAR', 'AREA', ARRAY[]::INTEGER[], 0)
) AS f ("slug", "key", "attributeKey", "optionKey", "placement", "control", "thresholds", "displayOrder")
JOIN "Category" c ON c."slug" = f."slug"
ON CONFLICT ("categoryId", "key") DO NOTHING;

-- 2. Sobe: "Kućni ljubimci dozvoljeni", which the "Ljubimci dozvoljeni"
-- switch reads on every Nekretnine page, last in the list as in the seed.
INSERT INTO "AttributeOption" ("id", "attributeId", "key", "displayOrder")
SELECT gen_random_uuid(), a."id", 'kucni-ljubimci-dozvoljeni',
       (SELECT COALESCE(MAX(o."displayOrder"), -1) + 1 FROM "AttributeOption" o WHERE o."attributeId" = a."id")
FROM "CategoryAttribute" a
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" = 'sobe' AND a."key" = 'sadrzaji'
ON CONFLICT ("attributeId", "key") DO NOTHING;

INSERT INTO "Translation" ("id", "entityType", "entityId", "field", "language", "value")
SELECT gen_random_uuid(), 'OPTION'::"TranslatableEntity", o."id", 'name', 'SR'::"Language", 'Kućni ljubimci dozvoljeni'
FROM "AttributeOption" o
JOIN "CategoryAttribute" a ON a."id" = o."attributeId"
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" = 'sobe' AND a."key" = 'sadrzaji' AND o."key" = 'kucni-ljubimci-dozvoljeni'
ON CONFLICT ("entityType", "entityId", "field", "language") DO NOTHING;

-- 3. Igraonice: "Pušenje dozvoljeno" leaves the playrooms' amenities, the
-- listings that ticked it included, and the options after it move up.
UPDATE "ListingAttribute" la
SET "valueOptionIds" = array_remove(la."valueOptionIds", o."id")
FROM "AttributeOption" o
JOIN "CategoryAttribute" a ON a."id" = o."attributeId"
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" = 'igraonice' AND a."key" = 'sadrzaji' AND o."key" = 'pusenje-dozvoljeno'
  AND la."attributeId" = a."id" AND o."id" = ANY(la."valueOptionIds");

UPDATE "AttributeOption" later
SET "displayOrder" = later."displayOrder" - 1
FROM "AttributeOption" o
JOIN "CategoryAttribute" a ON a."id" = o."attributeId"
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" = 'igraonice' AND a."key" = 'sadrzaji' AND o."key" = 'pusenje-dozvoljeno'
  AND later."attributeId" = o."attributeId" AND later."displayOrder" > o."displayOrder";

DELETE FROM "Translation" t
USING "AttributeOption" o
JOIN "CategoryAttribute" a ON a."id" = o."attributeId"
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" = 'igraonice' AND a."key" = 'sadrzaji' AND o."key" = 'pusenje-dozvoljeno'
  AND t."entityType" = 'OPTION' AND t."entityId" = o."id";

DELETE FROM "AttributeOption" o
USING "CategoryAttribute" a
JOIN "Category" c ON c."id" = a."categoryId"
WHERE o."attributeId" = a."id" AND c."slug" = 'igraonice' AND a."key" = 'sadrzaji' AND o."key" = 'pusenje-dozvoljeno';

-- 4. Igraonice: the age brackets read "4-6 godina" and "7-10 godina", and the
-- last one starts at 11. The keys stay, so ticked brackets stay ticked.
UPDATE "Translation" t
SET "value" = v."name"
FROM (VALUES
  ('1-3-godine', '1-3 godine'),
  ('4-6-godine', '4-6 godina'),
  ('7-10-godine', '7-10 godina'),
  ('10-godina', '11+ godina')
) AS v ("key", "name"),
"AttributeOption" o
JOIN "CategoryAttribute" a ON a."id" = o."attributeId"
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" = 'igraonice' AND a."key" = 'uzrast_dece' AND o."key" = v."key"
  AND t."entityType" = 'OPTION' AND t."entityId" = o."id" AND t."field" = 'name' AND t."language" = 'SR';

-- 5. Vozila: "Dostava na adresu", a yes/no field after Oprema in both
-- subcategories and a switch in their "Više filtera".
INSERT INTO "CategoryAttribute" ("id", "categoryId", "key", "type", "required", "isFilter", "filterType", "showOnCard", "displayOrder")
SELECT gen_random_uuid(), c."id", 'dostava_na_adresu', 'BOOLEAN'::"AttributeType", false, true, 'TOGGLE'::"FilterType", false,
       (SELECT COALESCE(MAX(a."displayOrder"), -1) + 1 FROM "CategoryAttribute" a WHERE a."categoryId" = c."id")
FROM "Category" c
WHERE c."slug" IN ('putnicka-vozila', 'dostavna-vozila')
ON CONFLICT ("categoryId", "key") DO NOTHING;

INSERT INTO "Translation" ("id", "entityType", "entityId", "field", "language", "value")
SELECT gen_random_uuid(), 'ATTRIBUTE'::"TranslatableEntity", a."id", 'name', 'SR'::"Language", 'Dostava na adresu'
FROM "CategoryAttribute" a
JOIN "Category" c ON c."id" = a."categoryId"
WHERE c."slug" IN ('putnicka-vozila', 'dostavna-vozila') AND a."key" = 'dostava_na_adresu'
ON CONFLICT ("entityType", "entityId", "field", "language") DO NOTHING;
