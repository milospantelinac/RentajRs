import { DEFAULT_REQUEST_RESPONSE_HOURS, getRequestExpiresAt, readRequestResponseHours } from './request-expiry';

describe('getRequestExpiresAt (Dizajn 41)', () => {
  const HOUR = 3_600_000;
  const createdAt = new Date(Date.UTC(2026, 8, 22, 10));

  it('gives the owner the hours from when the request came in', () => {
    const startsAt = new Date(createdAt.getTime() + 10 * 24 * HOUR);
    expect(getRequestExpiresAt({ createdAt, startsAt }, 48)).toEqual(new Date(createdAt.getTime() + 48 * HOUR));
  });

  it('ends at the start of the term when that comes first', () => {
    const startsAt = new Date(createdAt.getTime() + 5 * HOUR);
    expect(getRequestExpiresAt({ createdAt, startsAt }, 48)).toEqual(startsAt);
  });
});

describe('readRequestResponseHours (Dizajn 41)', () => {
  const prismaWith = (setting: unknown) => ({ setting: { findUnique: jest.fn().mockResolvedValue(setting) } }) as any;

  it('reads the hours the admin set', async () => {
    const prisma = prismaWith({ key: 'booking_request_response_hours', value: 24 });
    await expect(readRequestResponseHours(prisma)).resolves.toBe(24);
    expect(prisma.setting.findUnique).toHaveBeenCalledWith({ where: { key: 'booking_request_response_hours' } });
  });

  it.each([
    ['no setting', null],
    ['zero', { value: 0 }],
    ['a negative number', { value: -5 }],
    ['text', { value: '24' }],
    ['an empty value', { value: null }],
  ])('falls back to 48 hours for %s', async (_label, setting) => {
    await expect(readRequestResponseHours(prismaWith(setting))).resolves.toBe(DEFAULT_REQUEST_RESPONSE_HOURS);
  });
});
