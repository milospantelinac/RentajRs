import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService#assertTermRules (min/max guests, R30-ish term rules)', () => {
  const i18n = { t: jest.fn((key: string) => key) };

  function makeService() {
    return new BookingsService({} as any, {} as any, i18n as any, {} as any, {} as any);
  }

  function callAssertTermRules(
    service: BookingsService,
    listing: Partial<{
      minDuration: number | null;
      maxDuration: number | null;
      minGuests: number | null;
      maxGuests: number | null;
      earliestBookingHours: number | null;
      maxAdvanceBookingDays: number | null;
      priceUnit: string;
      bookingModel: string;
      slotSubmode: string | null;
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
      maxAdvanceBookingDays: null,
      priceUnit: 'DAY',
      bookingModel: 'PER_STAY',
      slotSubmode: null,
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

  it('counts working hours in hours, also when the price is per guest (Dizajn 23)', () => {
    const service = makeService();
    const start = new Date('2026-09-01T10:00:00Z');
    const listing = { bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS', priceUnit: 'GUEST', minDuration: 2, maxDuration: 4 };
    expect(() => callAssertTermRules(service, listing, start, new Date('2026-09-01T11:00:00Z'))).toThrow(BadRequestException);
    expect(() => callAssertTermRules(service, listing, start, new Date('2026-09-01T13:00:00Z'))).not.toThrow();
    expect(() => callAssertTermRules(service, listing, start, new Date('2026-09-01T15:00:00Z'))).toThrow(BadRequestException);
  });

  it('skips min/max duration for defined slots, which carry their own length (Dizajn 23)', () => {
    const service = makeService();
    const start = new Date('2026-09-01T10:00:00Z');
    const end = new Date('2026-09-01T12:00:00Z');
    const listing = { bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', priceUnit: 'SLOT', minDuration: 3, maxDuration: 1 };
    expect(() => callAssertTermRules(service, listing, start, end)).not.toThrow();
  });
});

describe('BookingsService price lines (Dizajn 34)', () => {
  const i18n = { t: jest.fn((key: string) => key) };
  const prisma = { listingExtraService: { findMany: jest.fn().mockResolvedValue([]) } };

  function pricingListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 'l1',
      priceUnit: 'HOUR',
      price: 350000n,
      weekendPrice: 420000n,
      pricePerGuest: null,
      mandatoryFees: [{ amount: 500 }],
      bookingModel: 'PER_SLOT',
      slotSubmode: 'WORKING_HOURS',
      advancePercent: null,
      ...overrides,
    };
  }

  function totals(availability: Record<string, jest.Mock>, listing: Record<string, unknown>, unitCount: number, slotPrice?: bigint, dto = {}) {
    const service = new BookingsService(prisma as any, availability as any, i18n as any, {} as any, {} as any);
    const start = new Date('2026-10-08T00:00:00Z');
    const end = new Date('2026-10-11T00:00:00Z');
    const pricePerUnit = slotPrice ?? (listing.price as bigint);
    return (service as any).computeTotals(listing, start, end, pricePerUnit, unitCount, slotPrice, dto);
  }

  it('groups the nights of a stay by price and rule, in the order they come', async () => {
    const availability = {
      getNightlyPrices: jest.fn().mockResolvedValue([
        { price: 650000n, kind: 'BASE' },
        { price: 800000n, kind: 'WEEKEND' },
        { price: 800000n, kind: 'WEEKEND' },
        { price: 650000n, kind: 'BASE' },
      ]),
    };
    const result = await totals(availability, pricingListing({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'NIGHT' }), 4);
    expect(result.priceLines).toEqual([
      { price: 650000n, kind: 'BASE', count: 2 },
      { price: 800000n, kind: 'WEEKEND', count: 2 },
    ]);
    expect(result.unitPriceTotal).toBe(2900000n);
    expect(result.totalAmount).toBe(2950000n);
  });

  it('prices every hour of a working-hours booking at the rule its start time falls under', async () => {
    const availability = { resolveHourlyPrice: jest.fn().mockResolvedValue({ price: 420000n, kind: 'WEEKEND' }) };
    const result = await totals(availability, pricingListing(), 2);
    expect(result.priceLines).toEqual([{ price: 420000n, kind: 'WEEKEND', count: 2 }]);
    expect(result.unitPriceTotal).toBe(840000n);
    expect(availability.resolveHourlyPrice.mock.calls[0][4]).toBe(420000n);
  });

  it('keeps a defined slot at its own price', async () => {
    const availability = { resolveHourlyPrice: jest.fn() };
    const result = await totals(availability, pricingListing(), 1, 700000n);
    expect(result.priceLines).toEqual([{ count: 1, price: 700000n, kind: 'BASE' }]);
    expect(availability.resolveHourlyPrice).not.toHaveBeenCalled();
  });

  it('prices each month of a monthly stay on its own', async () => {
    const availability = {
      getMonthlyPrices: jest.fn().mockResolvedValue([
        { price: 9000000n, kind: 'BASE' },
        { price: 8000000n, kind: 'SPECIAL' },
      ]),
    };
    const listing = pricingListing({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'MONTH', price: 9000000n });
    const result = await totals(availability, listing, 2, undefined, { monthCount: 2 });
    expect(result.priceLines).toEqual([
      { price: 9000000n, kind: 'BASE', count: 1 },
      { price: 8000000n, kind: 'SPECIAL', count: 1 },
    ]);
  });

  it('quotes the same lines in RSD for the request page (Dizajn 40)', async () => {
    const listing = pricingListing({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'NIGHT', price: 650000n, mandatoryFees: null });
    const quotePrisma = { ...prisma, listing: { findUniqueOrThrow: jest.fn().mockResolvedValue(listing) } };
    const availability = {
      getNightlyPrices: jest.fn().mockResolvedValue([
        { price: 650000n, kind: 'BASE' },
        { price: 800000n, kind: 'WEEKEND' },
        { price: 650000n, kind: 'BASE' },
      ]),
    };
    const service = new BookingsService(quotePrisma as any, availability as any, i18n as any, {} as any, {} as any);
    const quote = await service.quotePrice('l1', {
      startsAt: '2026-10-08T00:00:00.000Z',
      endsAt: '2026-10-11T00:00:00.000Z',
      guestCount: 2,
    } as any);
    expect(quote.priceLines).toEqual([
      { count: 2, price: 6500, kind: 'BASE' },
      { count: 1, price: 8000, kind: 'WEEKEND' },
    ]);
    expect(quote).toMatchObject({ unitCount: 3, unitPriceTotal: 21000, totalAmount: 21000 });
  });
});

describe('BookingsService#serialize priceBreakdown (Dizajn 34)', () => {
  const service = new BookingsService({} as any, {} as any, { t: (key: string) => key } as any, {} as any, {} as any);

  function booking(overrides: Record<string, unknown>) {
    return {
      id: 'b1',
      guestId: 'g1',
      ownerId: 'o1',
      pricePerUnit: 350000n,
      unitCount: 2,
      totalAmount: 750000n,
      amountDue: 750000n,
      fees: null,
      ...overrides,
    };
  }

  it('reads the kept lines and the fees in RSD', () => {
    const fees = {
      mandatory: '50000',
      guestFee: '0',
      extraServices: [{ serviceId: 's1', quantity: 1 }],
      extraServicesTotal: '20000',
      priceLines: [{ count: 2, price: '420000', kind: 'WEEKEND' }],
    };
    expect((service as any).serialize(booking({ fees, totalAmount: 910000n })).priceBreakdown).toEqual({
      lines: [{ count: 2, price: 4200, kind: 'WEEKEND' }],
      extras: 700,
    });
  });

  it('gives an older booking one line when its unit price explains the total', () => {
    const fees = { mandatory: '50000', guestFee: '0', extraServices: [] };
    expect((service as any).serialize(booking({ fees })).priceBreakdown).toEqual({
      lines: [{ count: 2, price: 3500, kind: 'BASE' }],
      extras: 500,
    });
  });

  it('gives no lines when an older booking was priced by another rule', () => {
    const fees = { mandatory: '0', guestFee: '0', extraServices: [] };
    expect((service as any).serialize(booking({ fees, totalAmount: 840000n })).priceBreakdown).toEqual({ lines: null, extras: 0 });
  });

  it('knows nothing when an older booking had extra services it never totalled', () => {
    const fees = { mandatory: '0', guestFee: '0', extraServices: [{ serviceId: 's1', quantity: 2 }] };
    expect((service as any).serialize(booking({ fees })).priceBreakdown).toEqual({ lines: null, extras: null });
  });
});

describe('BookingsService#listMine (Dizajn 34)', () => {
  it('puts open requests first, soonest first, then the rest, latest first', async () => {
    const at = (day: number) => new Date(Date.UTC(2026, 8, day, 14));
    const row = (id: string, status: string, day: number, categoryId = 'kids') => ({
      id,
      status,
      startsAt: at(day),
      endsAt: at(day),
      createdAt: at(1),
      guestId: 'g1',
      ownerId: 'o1',
      pricePerUnit: 350000n,
      unitCount: 2,
      totalAmount: 700000n,
      amountDue: 700000n,
      fees: null,
      guestCount: 12,
      listing: { title: 'Igraonica', slug: 'igraonica', categoryId, city: { name: 'Beograd' }, cityArea: { name: 'Vračar' } },
      guest: { firstName: 'Milica', lastName: 'Jovanović' },
      owner: { firstName: 'Dragan', lastName: 'Simić' },
    });
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          row('cancelled', 'CANCELLED', 28),
          row('confirmed', 'CONFIRMED', 16, 'hall'),
          row('requested-late', 'REQUESTED', 18),
          row('completed', 'COMPLETED', 5, 'room'),
          row('awaiting', 'AWAITING_PAYMENT', 13),
          row('rejected', 'REJECTED', 30),
          row('requested-soon', 'REQUESTED', 12),
        ]),
      },
    };
    const taxonomy = {
      resolveAttributesForCategory: jest.fn(async (id: string) => (id === 'kids' ? [{ key: 'kapacitet_dece' }] : [])),
      // Dizajn 39: a stay counts people.
      getCategoryTree: jest.fn(async () => [{ id: 'realestate', slug: 'nekretnine', children: [{ id: 'room', slug: 'sobe' }] }]),
    };
    const service = new BookingsService(prisma as any, {} as any, {} as any, {} as any, taxonomy as any);

    const rows = await service.listMine('o1', 'owner');
    expect(rows.map((r) => r.id)).toEqual([
      'requested-soon',
      'requested-late',
      'awaiting',
      'confirmed',
      'rejected',
      'cancelled',
      'completed',
    ]);
    expect(rows[0]).toMatchObject({
      listing: { title: 'Igraonica', slug: 'igraonica', place: 'Vračar' },
      guestUnit: 'children',
      guestShortName: 'Milica J.',
      totalAmount: 7000,
    });
    expect(rows[3].guestUnit).toBe('guests');
    expect(rows[6].guestUnit).toBe('people');
    expect(rows[0]).not.toHaveProperty('guestName');
    expect(rows[0]).not.toHaveProperty('ownerShortName');

    // Dizajn 39 (380:671): "Vlasnik: Dragan S." on the guest's rows.
    const asGuest = await service.listMine('g1', 'guest');
    expect(asGuest[0]).not.toHaveProperty('guestShortName');
    expect(asGuest[0]).toMatchObject({ ownerShortName: 'Dragan S.' });
  });
});

describe('BookingsService#cancelByGuest (Dizajn 39)', () => {
  const DAY = 86_400_000;

  function setup(overrides: Record<string, unknown>) {
    const booking = {
      id: 'b1',
      guestId: 'g1',
      ownerId: 'o1',
      status: 'CONFIRMED',
      paymentMethod: 'CASH',
      startsAt: new Date(Date.now() + 10 * DAY),
      endsAt: new Date(Date.now() + 12 * DAY),
      cancellationPolicyType: 'FREE_UNTIL_DAYS',
      cancellationThreshold: 5,
      pricePerUnit: 1000000n,
      unitCount: 2,
      totalAmount: 2000000n,
      amountDue: 2000000n,
      fees: null,
      ...overrides,
    };
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        update: jest.fn(async ({ data }: any) => ({ ...booking, ...data })),
      },
      bookingHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const availability = { releaseTermsForBooking: jest.fn().mockResolvedValue(undefined) };
    const i18n = { t: jest.fn((key: string) => key) };
    const events = { emit: jest.fn() };
    const service = new BookingsService(prisma as any, availability as any, i18n as any, events as any, {} as any);
    return { service, prisma, availability, events };
  }

  it('cancels a confirmed cash booking while its free cancellation lasts', async () => {
    const { service, availability, events } = setup({});
    const result = await service.cancelByGuest('g1', 'b1', {});
    expect(result.status).toBe('CANCELLED');
    expect(availability.releaseTermsForBooking).toHaveBeenCalledWith('b1');
    expect(events.emit).toHaveBeenCalledWith('booking.cancelled_by_guest', { bookingId: 'b1' });
  });

  it.each([
    ['after the free period', { startsAt: new Date(Date.now() + 3 * DAY) }],
    ['with no cancellation', { cancellationPolicyType: 'NO_CANCELLATION', cancellationThreshold: null }],
    ['without a policy on the booking', { cancellationPolicyType: null, cancellationThreshold: null }],
    ['when it was paid by transfer', { paymentMethod: 'BANK_TRANSFER' }],
  ])('refuses a confirmed booking %s', async (_label, overrides) => {
    const { service, prisma, availability } = setup(overrides);
    await expect(service.cancelByGuest('g1', 'b1', {})).rejects.toThrow('bookings.GUEST_CANCELLATION_CLOSED');
    expect(availability.releaseTermsForBooking).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('still withdraws a request and cancels an unpaid one whatever the policy', async () => {
    for (const status of ['REQUESTED', 'AWAITING_PAYMENT']) {
      const { service } = setup({ status, paymentMethod: 'BANK_TRANSFER', cancellationPolicyType: 'NO_CANCELLATION' });
      await expect(service.cancelByGuest('g1', 'b1', {})).resolves.toMatchObject({ status: 'CANCELLED' });
    }
  });

  it('refuses a completed booking as before', async () => {
    const { service } = setup({ status: 'COMPLETED' });
    await expect(service.cancelByGuest('g1', 'b1', {})).rejects.toThrow('bookings.INVALID_STATE');
  });
});

describe('BookingsService#disputeUnconfirmedPayment (one open report per booking)', () => {
  type DisputeRow = { id: string; type: string; bookingId: string; status: string };

  // Reads the where as Prisma does: a field it leaves out matches any row.
  const matches = (row: DisputeRow, where: any) =>
    (where.bookingId === undefined || row.bookingId === where.bookingId) &&
    (where.type === undefined || row.type === where.type) &&
    (where.status?.in === undefined || where.status.in.includes(row.status));

  function setup(overrides: Record<string, unknown> = {}, existing: DisputeRow[] = []) {
    const booking = {
      id: 'b1',
      guestId: 'g1',
      ownerId: 'o1',
      listingId: 'l1',
      status: 'AWAITING_PAYMENT',
      paymentDeadline: new Date(Date.now() + 3_600_000),
      ...overrides,
    };
    const disputes: DisputeRow[] = [...existing];
    const steps: string[] = [];
    // Like the row lock in Postgres: a second transaction waits at the lock
    // until the first one has finished.
    let lockQueue = Promise.resolve();
    const prisma: any = {
      booking: { findUnique: jest.fn(async () => ({ ...booking })) },
      dispute: {
        count: jest.fn(async ({ where }: any) => {
          steps.push('count');
          return disputes.filter((row) => matches(row, where)).length;
        }),
        create: jest.fn(async ({ data }: any) => {
          steps.push('create');
          const row = { id: `d${disputes.length + 1}`, status: 'NEW', ...data };
          disputes.push(row);
          return row;
        }),
      },
      $transaction: jest.fn(async (work: (tx: any) => Promise<unknown>) => {
        let release: () => void = () => {};
        const tx = {
          ...prisma,
          $queryRaw: jest.fn(async () => {
            const previous = lockQueue;
            lockQueue = new Promise<void>((resolve) => (release = () => resolve()));
            await previous;
            steps.push('lock');
            return [{ id: booking.id }];
          }),
        };
        try {
          return await work(tx);
        } finally {
          release();
        }
      }),
    };
    const i18n = { t: jest.fn((key: string) => key) };
    const events = { emit: jest.fn() };
    const service = new BookingsService(prisma, {} as any, i18n as any, events as any, {} as any);
    return { service, prisma, events, disputes, steps };
  }

  it('files the first report and tells the admins once', async () => {
    const { service, events, disputes, steps } = setup();
    await expect(service.disputeUnconfirmedPayment('g1', 'b1')).resolves.toEqual({ message: 'common.SUCCESS' });
    expect(disputes).toEqual([
      expect.objectContaining({ type: 'UNCONFIRMED_PAYMENT', bookingId: 'b1', listingId: 'l1', submittedByUserId: 'g1' }),
    ]);
    // The booking row is locked before the open reports are counted.
    expect(steps).toEqual(['lock', 'count', 'create']);
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('booking.payment_disputed', { bookingId: 'b1' });
  });

  it('refuses another report while the admin has the first one open', async () => {
    const { service, events, disputes } = setup();
    await service.disputeUnconfirmedPayment('g1', 'b1');
    for (const status of ['NEW', 'IN_PROGRESS']) {
      disputes[0].status = status;
      await expect(service.disputeUnconfirmedPayment('g1', 'b1')).rejects.toThrow('bookings.PAYMENT_ALREADY_REPORTED');
    }
    expect(disputes).toHaveLength(1);
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('files one report when two are sent at once', async () => {
    const { service, events, disputes } = setup();
    const results = await Promise.allSettled([
      service.disputeUnconfirmedPayment('g1', 'b1'),
      service.disputeUnconfirmedPayment('g1', 'b1'),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(disputes).toHaveLength(1);
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it.each(['RESOLVED', 'DISMISSED'])('takes a new report once the admin has marked the last one %s', async (status) => {
    const { service, events, disputes } = setup({}, [{ id: 'd0', type: 'UNCONFIRMED_PAYMENT', bookingId: 'b1', status }]);
    await service.disputeUnconfirmedPayment('g1', 'b1');
    expect(disputes).toHaveLength(2);
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it("ignores the booking's other disputes and other bookings' reports", async () => {
    const { service, disputes } = setup({}, [
      { id: 'd0', type: 'TERM_CONFLICT', bookingId: 'b1', status: 'NEW' },
      { id: 'd1', type: 'UNCONFIRMED_PAYMENT', bookingId: 'b2', status: 'NEW' },
    ]);
    await expect(service.disputeUnconfirmedPayment('g1', 'b1')).resolves.toEqual({ message: 'common.SUCCESS' });
    expect(disputes).toHaveLength(3);
  });

  it('refuses a booking that no longer waits for the payment, as before', async () => {
    const { service, prisma } = setup({ status: 'CONFIRMED' });
    await expect(service.disputeUnconfirmedPayment('g1', 'b1')).rejects.toThrow('bookings.INVALID_STATE');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // A report holds the booking past its deadline, so a new one after the
  // admin closed the last must not hold an overdue booking once more.
  it('refuses a report once the payment deadline has passed', async () => {
    const { service, events, disputes } = setup({ paymentDeadline: new Date(Date.now() - 60_000) });
    await expect(service.disputeUnconfirmedPayment('g1', 'b1')).rejects.toThrow('bookings.PAYMENT_DEADLINE_PASSED');
    expect(disputes).toHaveLength(0);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('still says the report is in when the deadline passed while it was open', async () => {
    const { service } = setup({ paymentDeadline: new Date(Date.now() - 60_000) }, [
      { id: 'd0', type: 'UNCONFIRMED_PAYMENT', bookingId: 'b1', status: 'NEW' },
    ]);
    await expect(service.disputeUnconfirmedPayment('g1', 'b1')).rejects.toThrow('bookings.PAYMENT_ALREADY_REPORTED');
  });
});

describe('BookingsService#getOne paymentDisputed', () => {
  function setup(overrides: Record<string, unknown> = {}, openReports = 0) {
    const booking = {
      id: 'b1',
      guestId: 'g1',
      ownerId: 'o1',
      listingId: 'l1',
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'BANK_TRANSFER',
      phoneUnlocked: false,
      startsAt: new Date(Date.UTC(2026, 9, 10, 12)),
      endsAt: new Date(Date.UTC(2026, 9, 12, 10)),
      createdAt: new Date(Date.UTC(2026, 8, 20, 10)),
      cancellationPolicyType: 'FREE_UNTIL_DAYS',
      cancellationThreshold: 5,
      pricePerUnit: 1000000n,
      unitCount: 2,
      totalAmount: 2000000n,
      amountDue: 2000000n,
      fees: null,
      listing: {
        title: 'Soba 22',
        slug: 'soba-22',
        address: 'Suvo Rudište bb',
        paymentMethod: 'BANK_TRANSFER',
        maxGuests: 2,
        categoryId: 'room',
        status: 'ACTIVE',
        pickupTime: null,
        returnTime: null,
        city: { name: 'Kopaonik' },
        cityArea: null,
        subscription: { package: { hasMessaging: true } },
      },
      guest: { firstName: 'Ivana', lastName: 'Marković', phone: null },
      owner: { firstName: 'Dragan', lastName: 'Simić', phone: null, bankAccount: '160-0000000000000-00', anonymizedAt: null },
      ...overrides,
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      bookingHistory: { findFirst: jest.fn().mockResolvedValue({ changedAt: new Date(Date.UTC(2026, 8, 21, 10)) }) },
      listingAttribute: { findMany: jest.fn().mockResolvedValue([]) },
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
      dispute: { count: jest.fn().mockResolvedValue(openReports) },
    };
    const taxonomy = {
      resolveAttributesForCategory: jest.fn().mockResolvedValue([]),
      getCategoryTree: jest.fn().mockResolvedValue([]),
      getCategoryNames: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new BookingsService(prisma as any, {} as any, {} as any, {} as any, taxonomy as any);
    return { service, prisma };
  }

  it('tells the guest a report of the payment is open', async () => {
    const { service, prisma } = setup({}, 1);
    await expect(service.getOne('g1', 'b1')).resolves.toMatchObject({ paymentDisputed: true });
    expect(prisma.dispute.count).toHaveBeenCalledWith({
      where: { bookingId: 'b1', type: 'UNCONFIRMED_PAYMENT', status: { in: ['NEW', 'IN_PROGRESS'] } },
    });
  });

  it('says no while nothing is open', async () => {
    const { service } = setup({}, 0);
    await expect(service.getOne('g1', 'b1')).resolves.toMatchObject({ paymentDisputed: false });
  });

  it('stops looking once the booking no longer waits for the payment', async () => {
    const { service, prisma } = setup({ status: 'CONFIRMED', paymentConfirmedAt: new Date(), phoneUnlocked: true }, 1);
    await expect(service.getOne('g1', 'b1')).resolves.toMatchObject({ paymentDisputed: false });
    expect(prisma.dispute.count).not.toHaveBeenCalled();
  });

  it('tells the owner too, whose card asks them to confirm the payment', async () => {
    const { service } = setup({}, 1);
    await expect(service.getOne('o1', 'b1')).resolves.toMatchObject({ paymentDisputed: true, guestShortName: 'Ivana M.' });
  });
});

describe('BookingsService#expireUnpaidBookings (an open payment report holds the booking)', () => {
  const MINUTE = 60_000;
  const DAY = 86_400_000;

  function setup(rows: Array<{ id: string; overdueBy: number; openReports?: number }>) {
    const bookings = rows.map(({ id, overdueBy, openReports = 0 }) => ({
      id,
      status: 'AWAITING_PAYMENT',
      paymentDeadline: new Date(Date.now() - overdueBy),
      disputes: Array.from({ length: openReports }, (_, i) => ({ id: `${id}-report${i}` })),
      pricePerUnit: 1000000n,
      unitCount: 1,
      totalAmount: 1000000n,
      amountDue: 1000000n,
      fees: null,
    }));
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue(bookings),
        update: jest.fn(async ({ where, data }: any) => ({ ...bookings.find((b) => b.id === where.id), ...data })),
      },
      bookingHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const availability = { releaseTermsForBooking: jest.fn().mockResolvedValue(undefined) };
    const events = { emit: jest.fn() };
    const service = new BookingsService(prisma as any, availability as any, {} as any, events as any, {} as any);
    return { service, prisma, availability, events };
  }

  it('expires what nobody reported and holds what the admin still has open, for at most seven days', async () => {
    const { service, prisma, availability, events } = setup([
      { id: 'unreported', overdueBy: MINUTE },
      { id: 'reported', overdueBy: MINUTE, openReports: 1 },
      { id: 'reportedSixDaysAgo', overdueBy: 7 * DAY - MINUTE, openReports: 1 },
      { id: 'reportedOverAWeekAgo', overdueBy: 7 * DAY + MINUTE, openReports: 1 },
    ]);
    await service.expireUnpaidBookings();

    const expired = ['unreported', 'reportedOverAWeekAgo'];
    expect(events.emit.mock.calls).toEqual(expired.map((bookingId) => ['booking.expired', { bookingId }]));
    expect(availability.releaseTermsForBooking.mock.calls).toEqual(expired.map((id) => [id]));
    expect(prisma.booking.update.mock.calls.map(([args]) => [args.where.id, args.data.status])).toEqual(
      expired.map((id) => [id, 'EXPIRED']),
    );
  });

  it('loads only the open reports, so one the admin closed holds nothing', async () => {
    const { service, prisma } = setup([]);
    await service.expireUnpaidBookings();
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { status: 'AWAITING_PAYMENT', paymentDeadline: { lt: expect.any(Date) } },
      include: { disputes: { where: { type: 'UNCONFIRMED_PAYMENT', status: { in: ['NEW', 'IN_PROGRESS'] } }, select: { id: true } } },
    });
  });
});

describe('BookingsService#sendPaymentDeadlineReminders', () => {
  it('sends no "pay before the deadline" nudge while the guest has the payment reported', async () => {
    const prisma = { booking: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new BookingsService(prisma as any, {} as any, {} as any, { emit: jest.fn() } as any, {} as any);
    await service.sendPaymentDeadlineReminders();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'AWAITING_PAYMENT',
          paymentDeadline: { not: null },
          disputes: { none: { type: 'UNCONFIRMED_PAYMENT', status: { in: ['NEW', 'IN_PROGRESS'] } } },
        },
      }),
    );
  });

  it('still nudges an unreported booking at the halfway point', async () => {
    const now = Date.now();
    const booking = {
      id: 'b1',
      paymentDeadline: new Date(now + 20 * 3_600_000),
      remindersSent: [],
      listing: { paymentDeadlineHours: 48 },
    };
    const prisma = {
      booking: { findMany: jest.fn().mockResolvedValue([booking]), update: jest.fn().mockResolvedValue({}) },
    };
    const events = { emit: jest.fn() };
    const service = new BookingsService(prisma as any, {} as any, {} as any, events as any, {} as any);
    await service.sendPaymentDeadlineReminders();
    expect(events.emit).toHaveBeenCalledWith('booking.payment_reminder_half', { bookingId: 'b1' });
  });
});

describe('BookingsService#disputeNoShow (one objection per mark)', () => {
  function setup(alreadyDisputed = false) {
    const booking = { id: 'b1', guestId: 'g1', ownerId: 'o1', listingId: 'l1', status: 'NO_SHOW', noShowDisputed: alreadyDisputed };
    const disputes: Array<Record<string, unknown>> = [];
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async () => ({ ...booking })),
        // Changes the row only while it still matches, as the database does.
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.id !== booking.id || where.noShowDisputed !== booking.noShowDisputed) return { count: 0 };
          Object.assign(booking, data);
          return { count: 1 };
        }),
      },
      dispute: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `d${disputes.length + 1}`, ...data };
          disputes.push(row);
          return row;
        }),
      },
      $transaction: jest.fn(async (work: (tx: any) => Promise<unknown>) => work(prisma)),
    };
    const i18n = { t: jest.fn((key: string) => key) };
    const events = { emit: jest.fn() };
    const service = new BookingsService(prisma, {} as any, i18n as any, events as any, {} as any);
    return { service, booking, disputes, events };
  }

  it('files the objection and marks the booking disputed', async () => {
    const { service, booking, disputes, events } = setup();
    await expect(service.disputeNoShow('g1', 'b1', { explanation: 'Stigli smo u 14:00.' })).resolves.toEqual({
      message: 'common.SUCCESS',
    });
    expect(booking.noShowDisputed).toBe(true);
    expect(disputes).toEqual([
      expect.objectContaining({ type: 'DISPUTED_NO_SHOW', bookingId: 'b1', description: 'Stigli smo u 14:00.' }),
    ]);
    expect(events.emit).toHaveBeenCalledWith('booking.no_show_disputed', { bookingId: 'b1', disputeId: 'd1' });
  });

  it('refuses a second objection to the same mark', async () => {
    const { service, disputes, events } = setup(true);
    await expect(service.disputeNoShow('g1', 'b1', { explanation: 'Opet.' })).rejects.toThrow('bookings.NO_SHOW_ALREADY_DISPUTED');
    expect(disputes).toHaveLength(0);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('files one objection when two are sent at once', async () => {
    const { service, disputes, events } = setup();
    const results = await Promise.allSettled([
      service.disputeNoShow('g1', 'b1', { explanation: 'Prvi.' }),
      service.disputeNoShow('g1', 'b1', { explanation: 'Drugi.' }),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(disputes).toHaveLength(1);
    expect(events.emit).toHaveBeenCalledTimes(1);
  });
});

describe('BookingsService#markNoShow', () => {
  it('clears an earlier objection, so a mark set again after an overturn can be disputed', async () => {
    const booking = {
      id: 'b1',
      guestId: 'g1',
      ownerId: 'o1',
      listingId: 'l1',
      status: 'CONFIRMED',
      noShowDisputed: true,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() + 3_600_000),
      pricePerUnit: 1000000n,
      unitCount: 1,
      totalAmount: 1000000n,
      amountDue: 1000000n,
      fees: null,
    };
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        update: jest.fn(async ({ data }: any) => ({ ...booking, ...data })),
      },
      bookingHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const availability = { releaseTermsForBooking: jest.fn().mockResolvedValue(undefined) };
    const i18n = { t: jest.fn((key: string) => key) };
    const events = { emit: jest.fn() };
    const service = new BookingsService(prisma as any, availability as any, i18n as any, events as any, {} as any);

    await expect(service.markNoShow('o1', 'b1')).resolves.toMatchObject({ status: 'NO_SHOW', noShowDisputed: false });
    expect(prisma.booking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { status: 'NO_SHOW', noShowDisputed: false } });
  });
});
