import { BookingStatus, CancellationPolicyType, PaymentMethod } from '@prisma/client';

const HOUR_MS = 3_600_000;

type BookingPolicy = {
  startsAt: Date;
  cancellationPolicyType: CancellationPolicyType | null;
  cancellationThreshold: number | null;
};

/**
 * Dizajn 39: the moment a booking's free cancellation ends ("do 5 dana pre
 * početka"), read from the policy frozen on the booking; null when it has none.
 */
export function getFreeCancellationUntil(booking: BookingPolicy): Date | null {
  const threshold = booking.cancellationThreshold;
  if (!threshold || threshold <= 0) return null;
  if (booking.cancellationPolicyType === 'FREE_UNTIL_DAYS') {
    return new Date(booking.startsAt.getTime() - threshold * 24 * HOUR_MS);
  }
  if (booking.cancellationPolicyType === 'FREE_UNTIL_HOURS') {
    return new Date(booking.startsAt.getTime() - threshold * HOUR_MS);
  }
  return null;
}

/**
 * What a guest may still cancel on their own: a request, a booking waiting for
 * payment and, since Dizajn 39 (528:514), a confirmed booking paid in cash on
 * arrival while its free cancellation lasts, since nothing was paid on it. A
 * booking paid by transfer stays with the owner ("gost otkaže posle uplate:
 * blokirano"), and so does a cash one once the free period is over.
 */
export function canGuestCancel(
  booking: BookingPolicy & { status: BookingStatus; paymentMethod: PaymentMethod },
  now: Date = new Date(),
): boolean {
  if (booking.status === 'REQUESTED' || booking.status === 'AWAITING_PAYMENT') return true;
  if (booking.status !== 'CONFIRMED' || booking.paymentMethod !== 'CASH') return false;
  const until = getFreeCancellationUntil(booking);
  return !!until && now.getTime() < until.getTime();
}
