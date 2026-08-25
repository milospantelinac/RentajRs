-- Subscriptions never auto-renew: the renewal/dunning cron always charged
-- through MockPaymentProvider (the real NestPay integration is a one-time 3D
-- Pay Hosting checkout with no reusable card token), so it was fabricating
-- successful "renewals" without ever billing a real card. Removing the whole
-- auto-renewal implementation (frontend, backend, and this schema).

-- Guard the enum narrowing below against any leftover dev/QA rows.
UPDATE "Subscription" SET "status" = 'EXPIRED' WHERE "status" = 'GRACE';
UPDATE "Transaction" SET "type" = 'SUBSCRIPTION' WHERE "type" = 'RENEWAL';

-- AlterTable
ALTER TABLE "Subscription"
  DROP COLUMN "autoRenew",
  DROP COLUMN "graceUntil",
  DROP COLUMN "paymentAttemptCount",
  DROP COLUMN "cardToken";

-- AlterEnum (drop SubscriptionStatus.GRACE)
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('AWAITING_PAYMENT', 'PENDING_ACTIVATION', 'ACTIVE', 'EXPIRED', 'CANCELLED');
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "SubscriptionStatus_old";
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACTIVATION';

-- AlterEnum (drop TransactionType.RENEWAL)
CREATE TYPE "TransactionType_new" AS ENUM ('SUBSCRIPTION', 'FEATURED');
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "TransactionType_old";
