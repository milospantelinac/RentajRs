-- Administracija > Oglasi: an admin adds a listing for an existing user and
-- publishes it without payment, for a number of months or days or with no end.

-- The admin who added a listing; admins may edit such a listing too.
ALTER TABLE "Listing" ADD COLUMN "createdByAdminId" UUID;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A package given without payment, and the admin's note on it.
ALTER TABLE "Subscription" ADD COLUMN "grantedByAdminId" UUID;
ALTER TABLE "Subscription" ADD COLUMN "grantNote" TEXT;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_grantedByAdminId_fkey"
  FOREIGN KEY ("grantedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The new permission, given to every current admin (anyone holding a permission).
INSERT INTO "Permission" ("id", "key", "description")
VALUES (gen_random_uuid(), 'manage_free_listings', 'Add listings for users without payment and set how long they last')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT DISTINCT granted."userId", free."id"
FROM "UserPermission" granted
CROSS JOIN "Permission" free
WHERE free."key" = 'manage_free_listings'
ON CONFLICT DO NOTHING;
