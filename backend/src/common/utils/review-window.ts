import { PrismaClient } from '@prisma/client';
import { endOfBelgradeDayAfter } from './timezone';

/**
 * Dizajn 43: a guest's review goes public the moment it is sent. The guest
 * has review_window_days after the booking completes to write it and
 * review_edit_days after it went public to change it (585:515, "Možete je
 * izmeniti u roku od 7 dana"). Both are admin-editable in /admin/podesavanja
 * and both run to the end of their last Belgrade day, the date the booking
 * page and the emails name.
 */
export const REVIEW_WINDOW_SETTING = 'review_window_days';
export const DEFAULT_REVIEW_WINDOW_DAYS = 14;
export const REVIEW_EDIT_SETTING = 'review_edit_days';
export const DEFAULT_REVIEW_EDIT_DAYS = 7;

type SettingReader = Pick<PrismaClient, 'setting'>;

async function readDays(prisma: SettingReader, key: string, fallback: number): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  const days = setting?.value;
  return typeof days === 'number' && days > 0 ? days : fallback;
}

export function readReviewWindowDays(prisma: SettingReader): Promise<number> {
  return readDays(prisma, REVIEW_WINDOW_SETTING, DEFAULT_REVIEW_WINDOW_DAYS);
}

export function readReviewEditDays(prisma: SettingReader): Promise<number> {
  return readDays(prisma, REVIEW_EDIT_SETTING, DEFAULT_REVIEW_EDIT_DAYS);
}

/** The last moment the guest can review a booking that completed at `completedAt`. */
export function getReviewDeadline(completedAt: Date, windowDays: number): Date {
  return endOfBelgradeDayAfter(completedAt, windowDays);
}

/** The last moment the author can change a review that went public at `publishedAt`. */
export function getReviewEditableUntil(publishedAt: Date, editDays: number): Date {
  return endOfBelgradeDayAfter(publishedAt, editDays);
}

/**
 * When a booking became COMPLETED: the automatic transition R91 records in
 * BookingHistory a day after the end. A row without that history counts
 * from its end.
 */
export async function readCompletedAt(
  prisma: Pick<PrismaClient, 'bookingHistory'>,
  booking: { id: string; endsAt: Date },
): Promise<Date> {
  const row = await prisma.bookingHistory.findFirst({
    where: { bookingId: booking.id, newStatus: 'COMPLETED' },
    orderBy: { changedAt: 'desc' },
    select: { changedAt: true },
  });
  return row?.changedAt ?? booking.endsAt;
}

/** The last moment the guest can review this booking. */
export async function readReviewDeadline(
  prisma: Pick<PrismaClient, 'setting' | 'bookingHistory'>,
  booking: { id: string; endsAt: Date },
): Promise<Date> {
  const [completedAt, windowDays] = await Promise.all([readCompletedAt(prisma, booking), readReviewWindowDays(prisma)]);
  return getReviewDeadline(completedAt, windowDays);
}
