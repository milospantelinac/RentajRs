import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService#assertTermRules (min/max guests, R30-ish term rules)', () => {
  const i18n = { t: jest.fn((key: string) => key) };

  function makeService() {
    return new BookingsService({} as any, {} as any, i18n as any, {} as any);
  }

  function callAssertTermRules(
    service: BookingsService,
    listing: Partial<{
      minDuration: number | null;
      maxDuration: number | null;
      minGuests: number | null;
      maxGuests: number | null;
      earliestBookingHours: number | null;
      priceUnit: string;
    }>,
    startsAt: Date,
    endsAt: Date,
    guestCount?: number,
  ) {
    const fullListing = {
      minDuration: null,
      maxDuration: null,
      minGuests: null,
      maxGuests: null,
      earliestBookingHours: null,
      priceUnit: 'DAY',
      ...listing,
    };
    return (service as any).assertTermRules(fullListing, startsAt, endsAt, guestCount);
  }

  beforeEach(() => i18n.t.mockClear());

  it('throws when the requested guest count is below minGuests', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-03T00:00:00Z');
    expect(() => callAssertTermRules(service, { minGuests: 2, maxGuests: 6 }, start, end, 1)).toThrow(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('errors.GUEST_COUNT_OUT_OF_RANGE', { args: { min: 2, max: 6 } });
  });

  it('throws when the requested guest count is above maxGuests', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-03T00:00:00Z');
    expect(() => callAssertTermRules(service, { minGuests: 2, maxGuests: 6 }, start, end, 8)).toThrow(
      BadRequestException,
    );
  });

  it('allows a guest count within [minGuests, maxGuests]', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-03T00:00:00Z');
    expect(() => callAssertTermRules(service, { minGuests: 2, maxGuests: 6 }, start, end, 4)).not.toThrow();
  });

  it('defaults the minimum to 1 when only maxGuests is set', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-03T00:00:00Z');
    expect(() => callAssertTermRules(service, { maxGuests: 4 }, start, end, 0)).toThrow(BadRequestException);
    expect(() => callAssertTermRules(service, { maxGuests: 4 }, start, end, 1)).not.toThrow();
  });

  it('skips the guest-count check entirely when the listing has no guest limits', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-03T00:00:00Z');
    expect(() => callAssertTermRules(service, {}, start, end, 999)).not.toThrow();
  });

  it('skips the guest-count check when guestCount is not provided', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-03T00:00:00Z');
    expect(() => callAssertTermRules(service, { minGuests: 2, maxGuests: 6 }, start, end, undefined)).not.toThrow();
  });

  it('rejects an end date on or before the start date', () => {
    const service = makeService();
    const start = new Date('2026-09-03T00:00:00Z');
    const end = new Date('2026-09-01T00:00:00Z');
    expect(() => callAssertTermRules(service, {}, start, end)).toThrow(BadRequestException);
  });

  it('enforces minDuration/maxDuration on the computed unit count', () => {
    const service = makeService();
    const start = new Date('2026-09-01T00:00:00Z');
    const twoNights = new Date('2026-09-03T00:00:00Z');
    expect(() =>
      callAssertTermRules(service, { minDuration: 3 }, start, twoNights),
    ).toThrow(BadRequestException);

    const tenNights = new Date('2026-09-11T00:00:00Z');
    expect(() =>
      callAssertTermRules(service, { maxDuration: 5 }, start, tenNights),
    ).toThrow(BadRequestException);
  });
});
