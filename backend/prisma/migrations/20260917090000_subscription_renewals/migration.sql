-- Renewing a package. A renewal bought while the package still runs waits as
-- SCHEDULED and takes over its listings when it ends; renewsSubscriptionId
-- links each paid period to the one it continues.

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'SCHEDULED' BEFORE 'ACTIVE';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "renewsSubscriptionId" UUID;

-- CreateIndex
CREATE INDEX "Subscription_renewsSubscriptionId_idx" ON "Subscription"("renewsSubscriptionId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_renewsSubscriptionId_fkey" FOREIGN KEY ("renewsSubscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
