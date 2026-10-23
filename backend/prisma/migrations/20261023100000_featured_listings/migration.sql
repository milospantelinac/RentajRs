-- Featured listings: where a period came from, owner requests and the queue of
-- a full category (replacing FeaturedWaitlist), daily counts of how often each
-- featured listing was shown and opened, the leaders' program and the rules
-- the admin sets in Administracija > Istaknuti oglasi.

-- CreateEnum
CREATE TYPE "FeaturedSource" AS ENUM ('ADMIN', 'REQUEST', 'LEADER', 'PAID');

-- CreateEnum
CREATE TYPE "FeaturedRequestStatus" AS ENUM ('PENDING', 'WAITING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "FeaturedListing" ADD COLUMN     "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endedNotifiedAt" TIMESTAMPTZ,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMPTZ,
ADD COLUMN     "source" "FeaturedSource" NOT NULL DEFAULT 'ADMIN';

-- A free period was given by an admin (R145); one with a price came from the old checkout.
UPDATE "FeaturedListing" SET "source" = CASE WHEN "free" THEN 'ADMIN'::"FeaturedSource" ELSE 'PAID'::"FeaturedSource" END;

-- Periods that are already over or about to end get no emails about it now.
UPDATE "FeaturedListing" SET "endedNotifiedAt" = CURRENT_TIMESTAMP WHERE "expiresAt" <= CURRENT_TIMESTAMP;
UPDATE "FeaturedListing" SET "reminderSentAt" = CURRENT_TIMESTAMP WHERE "expiresAt" <= CURRENT_TIMESTAMP + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leaderOverride" BOOLEAN;

-- CreateTable
CREATE TABLE "FeaturedRequest" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "source" "FeaturedSource" NOT NULL DEFAULT 'REQUEST',
    "status" "FeaturedRequestStatus" NOT NULL DEFAULT 'PENDING',
    "durationDays" INTEGER NOT NULL,
    "decisionNote" TEXT,
    "note" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ,
    "decidedByUserId" UUID,
    "featuredId" UUID,

    CONSTRAINT "FeaturedRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedStat" (
    "listingId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "searchImpressions" INTEGER NOT NULL DEFAULT 0,
    "homeImpressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeaturedStat_pkey" PRIMARY KEY ("listingId","date")
);

-- The old waitlist (nothing filled it since the mock checkout went) becomes
-- requests an admin decides on, oldest first.
INSERT INTO "FeaturedRequest" ("id", "listingId", "source", "status", "durationDays", "requestedAt")
SELECT gen_random_uuid(), "listingId", 'REQUEST', 'PENDING', 30, "requestedAt" FROM "FeaturedWaitlist";

-- DropForeignKey
ALTER TABLE "FeaturedWaitlist" DROP CONSTRAINT "FeaturedWaitlist_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FeaturedWaitlist" DROP CONSTRAINT "FeaturedWaitlist_listingId_fkey";

-- DropTable
DROP TABLE "FeaturedWaitlist";

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedRequest_featuredId_key" ON "FeaturedRequest"("featuredId");

-- CreateIndex
CREATE INDEX "FeaturedRequest_status_idx" ON "FeaturedRequest"("status");

-- CreateIndex
CREATE INDEX "FeaturedRequest_listingId_idx" ON "FeaturedRequest"("listingId");

-- AddForeignKey
ALTER TABLE "FeaturedRequest" ADD CONSTRAINT "FeaturedRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedRequest" ADD CONSTRAINT "FeaturedRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedRequest" ADD CONSTRAINT "FeaturedRequest_featuredId_fkey" FOREIGN KEY ("featuredId") REFERENCES "FeaturedListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedStat" ADD CONSTRAINT "FeaturedStat_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The rules of Administracija > Istaknuti oglasi. The old per-category limit
-- moves into them with the value it had.
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES (
  'featured_rules',
  jsonb_build_object(
    'enabled', true,
    'searchTopCount', 5,
    'homeDesktopCount', 4,
    'homePhoneCount', 1,
    'homeIntervalSeconds', 5,
    'maxPerCategory', COALESCE(
      (SELECT ("value" #>> '{}')::int FROM "Setting" WHERE "key" = 'max_featured_per_category' AND jsonb_typeof("value") = 'number'),
      10
    ),
    'categoryLimits', '{}'::jsonb,
    'maxPerOwnerPerCategory', 1,
    'defaultDays', 30
  ),
  'Featured listings: places at the top of search and on the home page, limits per category and owner, default length (Administracija > Istaknuti oglasi)',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES (
  'featured_leaders',
  '{"cutoffDate": null, "days": 30}'::jsonb,
  'Leaders'' program: an owner whose first listing went live by cutoffDate gets one free featured period of the given days (Administracija > Istaknuti oglasi)',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

DELETE FROM "Setting" WHERE "key" = 'max_featured_per_category';
