-- T115 (Tamara, 2026-10-10): "Uzrast dece" in the Igraonice bar takes several
-- ages at once and shows a playroom with any of them, as search-filters.seed-data.ts
-- now writes it. Running it twice changes nothing the second time.
UPDATE "CategoryFilter" f
SET "control" = 'MULTI_SELECT'::"FilterControl"
FROM "Category" c
WHERE f."categoryId" = c."id"
  AND c."slug" = 'igraonice'
  AND f."key" = 'uzrast_dece'
  AND f."control" <> 'MULTI_SELECT'::"FilterControl";
