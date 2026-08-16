-- CreateTable
CREATE TABLE "DatePriceOverride" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "price" BIGINT NOT NULL,

    CONSTRAINT "DatePriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatePriceOverride_listingId_idx" ON "DatePriceOverride"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "DatePriceOverride_listingId_date_key" ON "DatePriceOverride"("listingId", "date");

-- AddForeignKey
ALTER TABLE "DatePriceOverride" ADD CONSTRAINT "DatePriceOverride_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
