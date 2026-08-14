-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'AWAITING_PAYMENT';

-- Note: Prisma's schema diff also proposed dropping "listing_title_trgm_idx"
-- and "translation_value_trgm_idx" here. Those are pg_trgm GIN indexes created
-- by the raw-SQL migration 20260812232036_constraints_and_extensions — they
-- power fuzzy search/category-duplicate matching (R5) and were never declared
-- in schema.prisma, so Prisma sees them as drift on every future diff. This
-- migration intentionally does NOT touch them; deliberately excluded rather
-- than silently dropped.

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "pendingListingId" UUID;

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "clientId" TEXT NOT NULL DEFAULT '',
    "storeKeyEncrypted" TEXT,
    "apiUsername" TEXT NOT NULL DEFAULT '',
    "apiPasswordEncrypted" TEXT,
    "okUrl" TEXT NOT NULL DEFAULT '',
    "failUrl" TEXT NOT NULL DEFAULT '',
    "shopUrl" TEXT NOT NULL DEFAULT '',
    "apiEndpoint" TEXT NOT NULL DEFAULT 'https://testsecurepay.eway2pay.com',
    "transactionType" TEXT NOT NULL DEFAULT 'Auth',
    "currency" TEXT NOT NULL DEFAULT 'RSD',
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "merchantName" TEXT,
    "merchantTaxId" TEXT,
    "merchantAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);
