-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "remindersSent" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN "priceDropNotifiedAt" TIMESTAMPTZ;
