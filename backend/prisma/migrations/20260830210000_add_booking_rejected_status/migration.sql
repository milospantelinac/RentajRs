-- AlterEnum
-- T79 — a rejected request needs its own status, distinct from CANCELLED,
-- so the booking's displayed status can never contradict the email the
-- guest already received (booking_rejected vs booking_cancelled).
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';
