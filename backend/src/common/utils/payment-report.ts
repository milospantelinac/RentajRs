import { Prisma, ProcessingStatus } from '@prisma/client';

/** A dispute the admin has not closed yet (RESOLVED or DISMISSED). */
export const OPEN_DISPUTE_STATUSES: ProcessingStatus[] = ['NEW', 'IN_PROGRESS'];

/** T94: a guest's report that the owner has not confirmed their payment, still open. */
export const OPEN_PAYMENT_REPORT: Prisma.DisputeWhereInput = {
  type: 'UNCONFIRMED_PAYMENT',
  status: { in: OPEN_DISPUTE_STATUSES },
};

/**
 * How long an open report can hold a booking past its payment deadline. The
 * admin normally closes the report well before; this only keeps a forgotten
 * one from blocking the owner's term for good.
 */
export const PAYMENT_REPORT_HOLD_MS = 7 * 86_400_000;

/**
 * Whether an overdue booking still waits instead of expiring: the guest
 * reported a payment the owner has not confirmed, and the admin has not
 * closed that report yet. `disputes` are the booking's open reports only,
 * loaded with `include: { disputes: { where: OPEN_PAYMENT_REPORT } }`.
 */
export function isHeldByPaymentReport(
  booking: { paymentDeadline: Date | null; disputes: unknown[] },
  now: number = Date.now(),
): boolean {
  if (!booking.paymentDeadline || booking.disputes.length === 0) return false;
  return now < booking.paymentDeadline.getTime() + PAYMENT_REPORT_HOLD_MS;
}
