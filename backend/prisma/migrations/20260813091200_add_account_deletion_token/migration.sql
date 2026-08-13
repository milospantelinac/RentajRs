-- AlterTable
ALTER TABLE "User" ADD COLUMN "pendingDeletionTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingDeletionExpiresAt" TIMESTAMPTZ;
