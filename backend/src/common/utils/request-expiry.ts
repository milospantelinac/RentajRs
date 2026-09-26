import { PrismaClient } from '@prisma/client';

const HOUR_MS = 3_600_000;

/**
 * Dizajn 41: a request the owner leaves unanswered expires, as the guest is
 * told once it is sent ("Ako ne odgovori u roku, zahtev ističe i termin se
 * oslobađa"). The hours are admin-editable in /admin/podesavanja.
 */
export const REQUEST_RESPONSE_HOURS_SETTING = 'booking_request_response_hours';
export const DEFAULT_REQUEST_RESPONSE_HOURS = 48;

export async function readRequestResponseHours(prisma: Pick<PrismaClient, 'setting'>): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: REQUEST_RESPONSE_HOURS_SETTING } });
  const hours = setting?.value;
  return typeof hours === 'number' && hours > 0 ? hours : DEFAULT_REQUEST_RESPONSE_HOURS;
}

/**
 * When an unanswered request expires: its hours after it came in, or the start
 * of its own term if that comes first, since a term that has begun can no
 * longer be agreed.
 */
export function getRequestExpiresAt(booking: { createdAt: Date; startsAt: Date }, hours: number): Date {
  return new Date(Math.min(booking.createdAt.getTime() + hours * HOUR_MS, booking.startsAt.getTime()));
}
