-- Fiscal receipts (Fiscomm): the Invoice row becomes the receipt's own queue
-- entry. A receipt is born PENDING in the same transaction as its payment and
-- is issued afterwards, with retries (FiscalizationService), so a slow fiscal
-- service never loses a receipt. Everything here is additive.

CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

-- A pending receipt has no number yet.
ALTER TABLE "Invoice" ALTER COLUMN "documentNumber" DROP NOT NULL;

-- The rows that exist were written by the placeholder provider and are done:
-- they become ISSUED, and only then does the default turn to PENDING for new rows.
ALTER TABLE "Invoice" ADD COLUMN "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED';
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Running number (existing rows get theirs from the sequence), the base of orderNumber.
ALTER TABLE "Invoice" ADD COLUMN "number" SERIAL NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "description" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "buyerTaxId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "invoiceCounter" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "verificationUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuedAt" TIMESTAMPTZ;
ALTER TABLE "Invoice" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "nextAttemptAt" TIMESTAMPTZ;
ALTER TABLE "Invoice" ADD COLUMN "lastError" TEXT;

CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX "Invoice_orderNumber_key" ON "Invoice"("orderNumber");
CREATE INDEX "Invoice_status_nextAttemptAt_idx" ON "Invoice"("status", "nextAttemptAt");
