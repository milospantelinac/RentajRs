-- T129: the category picture uploaded in Administracija > Kategorije.
ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT;

-- Promote used to store a redirect from a URL to itself; served now, it would loop.
DELETE FROM "Redirect" WHERE "oldPath" = "newPath";
