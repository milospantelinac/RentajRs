-- T115: the /pretraga filters of each category (bar or "Više filtera", in
-- order) live in their own table. The rows come with 20261009210100.

-- CreateEnum
CREATE TYPE "FilterPlacement" AS ENUM ('BAR', 'PANEL');

-- CreateEnum
CREATE TYPE "FilterControl" AS ENUM ('GUESTS', 'AREA', 'SELECT', 'MULTI_SELECT', 'ALL_OF', 'MIN', 'RANGE', 'TOGGLE', 'OPTION_TOGGLE');

-- CreateTable
CREATE TABLE "CategoryFilter" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "attributeKey" TEXT,
    "optionKey" TEXT,
    "placement" "FilterPlacement" NOT NULL,
    "control" "FilterControl" NOT NULL,
    "thresholds" INTEGER[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilter_categoryId_key_key" ON "CategoryFilter"("categoryId", "key");

-- AddForeignKey
ALTER TABLE "CategoryFilter" ADD CONSTRAINT "CategoryFilter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
