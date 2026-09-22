-- Dizajn 43: a review is the guest's alone and goes public the moment it is
-- sent. Owners no longer rate guests (there is no public guest profile to
-- show it on), so their ratings and the quick tags about guests are removed
-- from the data, and with them the direction and the published flag that
-- held a review back until the other side wrote theirs (R96).

-- Owners' ratings of guests. Their quick tags go with them (ON DELETE
-- CASCADE); a reply only ever answered a guest's review. No listing rating
-- ever counted them.
DELETE FROM "Review" WHERE "direction" = 'OWNER_TO_GUEST';

-- A guest review still waiting for the owner's is public from now on, so its
-- listing's rating counts it. Only those listings are recounted: every other
-- one already counts exactly its public guest reviews (some demo listings
-- carry a rating without review rows, and a full recount would wipe it).
UPDATE "Listing" AS l
SET "avgRating" = r."avg", "reviewCount" = r."count"
FROM (
  SELECT rv."listingId",
         ROUND(AVG(rv."rating")::NUMERIC, 1) AS "avg",
         COUNT(*)::INTEGER AS "count"
  FROM "Review" rv
  WHERE rv."hiddenByAdmin" = false
    AND rv."listingId" IN (SELECT "listingId" FROM "Review" WHERE "published" = false AND "hiddenByAdmin" = false)
  GROUP BY rv."listingId"
) AS r
WHERE l."id" = r."listingId";

-- It went public now, which also starts its review_edit_days.
UPDATE "Review" SET "publishedAt" = CURRENT_TIMESTAMP WHERE "published" = false OR "publishedAt" IS NULL;

-- DropForeignKey
ALTER TABLE "ReviewTagRow" DROP CONSTRAINT "ReviewTagRow_reviewId_fkey";

-- DropTable
DROP TABLE "ReviewTagRow";

-- DropEnum
DROP TYPE "ReviewTag";

-- DropIndex
DROP INDEX "Review_bookingId_direction_key";

-- DropIndex
DROP INDEX "Review_recipientId_published_idx";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "direction",
DROP COLUMN "published",
ALTER COLUMN "publishedAt" SET NOT NULL,
ALTER COLUMN "publishedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- DropEnum
DROP TYPE "ReviewDirection";

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_recipientId_idx" ON "Review"("recipientId");

-- review_window_days used to be how long a review waited for the other side;
-- it is now how long the guest has to write one.
UPDATE "Setting"
SET "description" = 'Dizajn 43: days after a booking completes in which its guest can leave a review'
WHERE "key" = 'review_window_days';
