-- Dizajn 50: a category can be active without being shown on the site. The
-- admin publishes or hides it in /admin/kategorije ("Prikaži na sajtu"), and
-- the seed never changes the flag. Every existing category stays published
-- except Ostalo, which until now was hidden by a slug check in the code: it
-- waits for the owner to publish it, so this migration does not.
ALTER TABLE "Category" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Category" SET "published" = false WHERE "slug" = 'ostalo';
