-- AlterEnum
ALTER TYPE "AttributeType" ADD VALUE 'TEXTAREA';
ALTER TYPE "AttributeType" ADD VALUE 'YEAR';
ALTER TYPE "AttributeType" ADD VALUE 'CHECKBOX_GROUP';

-- CreateEnum
CREATE TYPE "CancellationPolicyType" AS ENUM ('NO_CANCELLATION', 'FREE_UNTIL_DAYS', 'FREE_UNTIL_HOURS');

-- AlterTable
ALTER TABLE "CategoryAttribute" ADD COLUMN "showOnCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CategoryAttribute" ADD COLUMN "dependsOnAttrKey" TEXT;
ALTER TABLE "CategoryAttribute" ADD COLUMN "dependsOnOptionKey" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "maxAdvanceBookingDays" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "cancellationPolicyType" "CancellationPolicyType";
ALTER TABLE "Listing" ADD COLUMN "cancellationThreshold" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "pendingCategoryAssignment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" DROP COLUMN "cancellationTerms";

-- CreateTable
CREATE TABLE "HourlyPriceRange" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "price" BIGINT NOT NULL,

    CONSTRAINT "HourlyPriceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotPriceOverride" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "price" BIGINT NOT NULL,

    CONSTRAINT "SlotPriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HourlyPriceRange_listingId_idx" ON "HourlyPriceRange"("listingId");

-- CreateIndex
CREATE INDEX "SlotPriceOverride_listingId_date_idx" ON "SlotPriceOverride"("listingId", "date");

-- AddForeignKey
ALTER TABLE "HourlyPriceRange" ADD CONSTRAINT "HourlyPriceRange_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotPriceOverride" ADD CONSTRAINT "SlotPriceOverride_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
