-- AlterTable
ALTER TABLE "User" ADD COLUMN "profileSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");
