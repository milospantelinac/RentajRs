-- T136: a guest asks to move a booking to another term and the owner
-- approves or rejects (BookingChangesService).
CREATE TYPE "BookingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

CREATE TABLE "BookingChangeRequest" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "status" "BookingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "oldStartsAt" TIMESTAMPTZ NOT NULL,
    "oldEndsAt" TIMESTAMPTZ NOT NULL,
    "newStartsAt" TIMESTAMPTZ NOT NULL,
    "newEndsAt" TIMESTAMPTZ NOT NULL,
    "oldTotalAmount" BIGINT NOT NULL,
    "newPricePerUnit" BIGINT NOT NULL,
    "newUnitCount" INTEGER NOT NULL,
    "newTotalAmount" BIGINT NOT NULL,
    "newAmountDue" BIGINT NOT NULL,
    "newFees" JSONB NOT NULL,
    "guestMessage" TEXT,
    "ownerReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ,
    "decidedByUserId" UUID,

    CONSTRAINT "BookingChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingChangeRequest_bookingId_status_idx" ON "BookingChangeRequest"("bookingId", "status");

CREATE INDEX "BookingChangeRequest_status_createdAt_idx" ON "BookingChangeRequest"("status", "createdAt");

ALTER TABLE "BookingChangeRequest" ADD CONSTRAINT "BookingChangeRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One request at a time per booking, even when two are sent at once.
CREATE UNIQUE INDEX "booking_change_one_pending" ON "BookingChangeRequest"("bookingId") WHERE "status" = 'PENDING';

-- How many hours before a booking starts its guest may still ask for another
-- term (card T136: 48, an admin setting, T129 brings it into the panel).
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES (
  'booking_change_deadline_hours',
  '48'::jsonb,
  'T136: hours before a booking starts until which its guest can still ask the owner to move it to another term',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
