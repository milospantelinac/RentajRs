import { BookingChangeRequest, BookingStatus, PrismaClient } from '@prisma/client';
import { paraToRsd } from './money';

const HOUR_MS = 3_600_000;

/**
 * T136: a guest may ask the owner to move a booking to another term until
 * this many hours before it starts; later they agree it with the owner
 * directly. Admin-editable in /admin/podesavanja (T129 brings it into the
 * panel); the migration inserts the row.
 */
export const CHANGE_DEADLINE_HOURS_SETTING = 'booking_change_deadline_hours';
export const DEFAULT_CHANGE_DEADLINE_HOURS = 48;

/** The bookings whose term can still be moved: sent, waiting for the payment, or confirmed. */
export const CHANGEABLE_STATUSES: BookingStatus[] = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'];

export async function readChangeDeadlineHours(prisma: Pick<PrismaClient, 'setting'>): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: CHANGE_DEADLINE_HOURS_SETTING } });
  const hours = setting?.value;
  return typeof hours === 'number' && hours >= 0 ? hours : DEFAULT_CHANGE_DEADLINE_HOURS;
}

/** The last moment a change can be asked for. */
export function getChangeDeadline(startsAt: Date, hours: number): Date {
  return new Date(startsAt.getTime() - hours * HOUR_MS);
}

/**
 * When an unanswered change request expires: as long after it was sent as an
 * owner has to answer a booking request (booking_request_response_hours), or
 * once either term begins, whichever comes first.
 */
export function getChangeExpiresAt(
  request: Pick<BookingChangeRequest, 'createdAt' | 'oldStartsAt' | 'newStartsAt'>,
  responseHours: number,
): Date {
  return new Date(
    Math.min(request.createdAt.getTime() + responseHours * HOUR_MS, request.oldStartsAt.getTime(), request.newStartsAt.getTime()),
  );
}

/** A change request as both sides' pages read it, money in RSD. */
export function toChangeView(request: BookingChangeRequest) {
  const fees = (request.newFees ?? {}) as { priceLines?: Array<{ count: number; price: string; kind: string }> };
  const lines = Array.isArray(fees.priceLines) ? fees.priceLines : [];
  return {
    id: request.id,
    status: request.status,
    oldStartsAt: request.oldStartsAt,
    oldEndsAt: request.oldEndsAt,
    newStartsAt: request.newStartsAt,
    newEndsAt: request.newEndsAt,
    oldTotalAmount: paraToRsd(request.oldTotalAmount),
    newTotalAmount: paraToRsd(request.newTotalAmount),
    newAmountDue: paraToRsd(request.newAmountDue),
    newPriceLines: lines.map((line) => ({ count: line.count, price: paraToRsd(BigInt(line.price)), kind: line.kind })),
    guestMessage: request.guestMessage,
    ownerReason: request.ownerReason,
    createdAt: request.createdAt,
    decidedAt: request.decidedAt,
  };
}

/**
 * What a booking's page says about moving it: the request waiting for the
 * owner, the last one decided, and whether its guest may send one now (the
 * listing still takes bookings, the deadline is ahead, none is waiting).
 */
export function describeBookingChange(
  booking: { status: BookingStatus; startsAt: Date },
  requests: BookingChangeRequest[],
  options: { deadlineHours: number; listingBookable: boolean; asGuest: boolean; now?: number },
) {
  const now = options.now ?? Date.now();
  const sorted = [...requests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const pending = sorted.find((request) => request.status === 'PENDING') ?? null;
  const last = sorted.find((request) => request.status !== 'PENDING') ?? null;
  const deadlineAt = getChangeDeadline(booking.startsAt, options.deadlineHours);
  const open = CHANGEABLE_STATUSES.includes(booking.status);
  return {
    pending: pending ? toChangeView(pending) : null,
    // A decision older than the request now waiting is not news.
    last: last && (!pending || last.createdAt > pending.createdAt) ? toChangeView(last) : null,
    canRequest: options.asGuest && open && options.listingBookable && !pending && now < deadlineAt.getTime(),
    deadlinePassed: open && now >= deadlineAt.getTime(),
    deadlineAt,
    deadlineHours: options.deadlineHours,
  };
}
