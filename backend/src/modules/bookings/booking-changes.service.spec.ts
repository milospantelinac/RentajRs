import { Prisma } from '@prisma/client';
import { describeBookingChange, getChangeExpiresAt } from '../../common/utils/booking-change';
import { BookingChangesService } from './booking-changes.service';

const i18n = { t: jest.fn((key: string) => key) };
const HOUR = 3_600_000;

function bookingRow(overrides: Record<string, any> = {}) {
  return {
    id: 'b1',
    listingId: 'l1',
    guestId: 'g1',
    ownerId: 'o1',
    status: 'CONFIRMED',
    startsAt: new Date(Date.now() + 10 * 24 * HOUR),
    endsAt: new Date(Date.now() + 12 * 24 * HOUR),
    guestCount: 2,
    totalAmount: 1_000_000n,
    amountDue: 300_000n,
    pricePerUnit: 500_000n,
    unitCount: 2,
    fees: { extraServices: [{ serviceId: 's1', quantity: 1 }], priceLines: [] },
    remindersSent: ['day_before', 'payment_half'],
    createdAt: new Date(),
    ...overrides,
  };
}

const listingRow = {
  id: 'l1',
  status: 'ACTIVE',
  bookingModel: 'PER_STAY',
  slotSubmode: null,
  priceUnit: 'NIGHT',
  price: 500_000n,
  maxGuests: 4,
  gapAfterMinutes: 0,
  subscription: { package: { hasBookings: true } },
};

const NEW_START = new Date(Date.now() + 20 * 24 * HOUR);
const NEW_END = new Date(Date.now() + 23 * 24 * HOUR);

function setup({ booking = bookingRow(), pendingCount = 0, clash = null as any, deadlineHours = 48 } = {}) {
  const prisma: any = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    listing: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(listingRow),
    },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: deadlineHours }) },
    blockedTerm: { findFirst: jest.fn().mockResolvedValue(clash), findMany: jest.fn().mockResolvedValue([{ id: 'own' }]) },
    bookingChangeRequest: {
      count: jest.fn().mockResolvedValue(pendingCount),
      create: jest.fn(({ data }) => Promise.resolve({ id: 'c1', status: 'PENDING', createdAt: new Date(), decidedAt: null, ownerReason: null, ...data })),
    },
  };
  const bookings = {
    resolveRequestedTerm: jest.fn().mockResolvedValue({ startsAt: NEW_START, endsAt: NEW_END }),
    getGuestCapacity: jest.fn().mockResolvedValue(4),
    assertTermRules: jest.fn(),
    computeTotals: jest.fn().mockResolvedValue({
      priceLines: [{ count: 3, price: 500_000n, kind: 'BASE' }],
      unitPriceTotal: 1_500_000n,
      guestFee: 0n,
      mandatoryFeesTotal: 0n,
      extraServicesTotal: 100_000n,
      totalAmount: 1_600_000n,
      amountDue: 480_000n,
    }),
  };
  const availability = {
    fitsWorkingHours: jest.fn().mockResolvedValue(true),
    isInBlockedWorkingDay: jest.fn().mockResolvedValue(false),
    applyGapAfter: jest.fn(),
    getAvailability: jest.fn().mockResolvedValue({ blocked: [{ id: 'own' }, { id: 'other' }], workingHours: [] }),
  };
  const events = { emit: jest.fn() };
  const service = new BookingChangesService(prisma, bookings as any, availability as any, i18n as any, events as any);
  return { service, prisma, bookings, availability, events };
}

describe('BookingChangesService#request (T136)', () => {
  const dto = { startsAt: NEW_START.toISOString(), endsAt: NEW_END.toISOString(), guestMessage: ' Molim vas, kasnije  ' };

  it('saves the new term priced like a new request, with the booking guests and extra services, and tells the owner', async () => {
    const { service, prisma, bookings, events } = setup();
    const view = await service.request('g1', 'b1', dto);
    expect(bookings.assertTermRules).toHaveBeenCalledWith(expect.objectContaining({ maxGuests: 4 }), NEW_START, NEW_END, 2);
    expect(bookings.computeTotals).toHaveBeenCalledWith(listingRow, NEW_START, NEW_END, 500_000n, 3, undefined, {
      guestCount: 2,
      extraServices: [{ serviceId: 's1', quantity: 1 }],
      monthCount: undefined,
    });
    expect(prisma.bookingChangeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'b1',
        newStartsAt: NEW_START,
        newEndsAt: NEW_END,
        oldTotalAmount: 1_000_000n,
        newTotalAmount: 1_600_000n,
        newAmountDue: 480_000n,
        newFees: { mandatory: '0', extraServicesTotal: '100000', guestFee: '0', priceLines: [{ count: 3, price: '500000', kind: 'BASE' }] },
        guestMessage: 'Molim vas, kasnije',
      }),
    });
    expect(view).toMatchObject({ newTotalAmount: 16_000, oldTotalAmount: 10_000 });
    expect(events.emit).toHaveBeenCalledWith('booking.change_requested', { bookingId: 'b1', changeRequestId: 'c1' });
  });

  it('looks for a clash with anything but the booking own terms', async () => {
    const { service, prisma } = setup();
    await service.quote('g1', 'b1', dto);
    expect(prisma.blockedTerm.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'l1',
        startsAt: { lt: NEW_END },
        endsAt: { gt: NEW_START },
        OR: [{ bookingId: null }, { bookingId: { not: 'b1' } }],
      },
      select: { id: true },
    });
  });

  it('refuses a taken term, the same term, a second request and a change after the deadline', async () => {
    await expect(setup({ clash: { id: 'x' } }).service.request('g1', 'b1', dto)).rejects.toThrow('bookings.CHANGE_TERM_TAKEN');
    await expect(setup({ pendingCount: 1 }).service.request('g1', 'b1', dto)).rejects.toThrow('bookings.CHANGE_ALREADY_PENDING');
    const soon = bookingRow({ startsAt: new Date(Date.now() + 47 * HOUR) });
    await expect(setup({ booking: soon }).service.request('g1', 'b1', dto)).rejects.toThrow('bookings.CHANGE_DEADLINE_PASSED');
    const booking = bookingRow();
    const same = setup({ booking });
    same.bookings.resolveRequestedTerm.mockResolvedValue({ startsAt: booking.startsAt, endsAt: booking.endsAt });
    await expect(same.service.request('g1', 'b1', dto)).rejects.toThrow('bookings.CHANGE_SAME_TERM');
    await expect(setup({ booking: bookingRow({ status: 'COMPLETED' }) }).service.request('g1', 'b1', dto)).rejects.toThrow('bookings.INVALID_STATE');
    await expect(setup().service.request('someone-else', 'b1', dto)).rejects.toThrow();
  });

  it('answers a second request sent at the same moment as already pending', async () => {
    const { service, prisma } = setup();
    prisma.bookingChangeRequest.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.request('g1', 'b1', dto)).rejects.toThrow('bookings.CHANGE_ALREADY_PENDING');
  });

  it("shows the change screen the listing's terms with the booking's own left free", async () => {
    const { service } = setup();
    const data = await service.getAvailability('g1', 'b1', new Date(), new Date());
    expect(data.blocked).toEqual([{ id: 'other' }]);
  });
});

describe('BookingChangesService#approve (T136)', () => {
  function withPending(booking = bookingRow(), pending: Record<string, any> = {}) {
    const ctx = setup({ booking });
    const tx: any = {
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      blockedTerm: { deleteMany: jest.fn(), create: jest.fn() },
      bookingChangeRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    ctx.prisma.bookingChangeRequest.findFirst = jest.fn().mockResolvedValue({
      id: 'c1',
      status: 'PENDING',
      newStartsAt: NEW_START,
      newEndsAt: NEW_END,
      newPricePerUnit: 500_000n,
      newUnitCount: 3,
      newTotalAmount: 1_600_000n,
      newAmountDue: 480_000n,
      newFees: { mandatory: '0', extraServicesTotal: '100000', guestFee: '0', priceLines: [{ count: 3, price: '500000', kind: 'BASE' }] },
      ...pending,
    });
    ctx.prisma.bookingChangeRequest.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    ctx.prisma.bookingChangeRequest.findUnique = jest.fn().mockResolvedValue({ bookingId: 'b1' });
    ctx.prisma.listing.findUniqueOrThrow.mockResolvedValue({ ...listingRow, gapAfterMinutes: 60 });
    ctx.prisma.$transaction = jest.fn((run: (client: any) => unknown) => run(tx));
    return { ...ctx, tx };
  }

  it('moves the booking, its price and its held term in one transaction, keeps the advance and resets the day-before reminder', async () => {
    const booking = bookingRow();
    const { service, tx, availability, events } = withPending(booking);
    await service.approve('o1', 'b1');
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: 'CONFIRMED', startsAt: booking.startsAt, endsAt: booking.endsAt },
      data: {
        startsAt: NEW_START,
        endsAt: NEW_END,
        pricePerUnit: 500_000n,
        unitCount: 3,
        totalAmount: 1_600_000n,
        fees: {
          extraServices: [{ serviceId: 's1', quantity: 1 }],
          mandatory: '0',
          extraServicesTotal: '100000',
          guestFee: '0',
          priceLines: [{ count: 3, price: '500000', kind: 'BASE' }],
        },
        remindersSent: ['payment_half'],
      },
    });
    expect(tx.blockedTerm.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'b1' } });
    expect(tx.blockedTerm.create).toHaveBeenCalledWith({
      data: { listingId: 'l1', bookingId: 'b1', startsAt: NEW_START, endsAt: NEW_END, source: 'BOOKING' },
    });
    expect(tx.bookingChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', decidedByUserId: 'o1' }),
    });
    expect(availability.applyGapAfter).toHaveBeenCalledWith('l1', 'b1', NEW_END, 60);
    expect(events.emit).toHaveBeenCalledWith('booking.change_approved', { bookingId: 'b1', changeRequestId: 'c1' });
  });

  it('gives a booking still waiting for the owner the new advance with the new price', async () => {
    const { service, tx } = withPending(bookingRow({ status: 'REQUESTED' }));
    await service.approve('o1', 'b1');
    expect(tx.booking.updateMany.mock.calls[0][0].data.amountDue).toBe(480_000n);
  });

  it('refuses a term taken since the request and leaves it waiting', async () => {
    const { service, tx, prisma } = withPending();
    tx.blockedTerm.create.mockRejectedValue(new Error('violates exclusion constraint "blocked_term_no_overlap"'));
    await expect(service.approve('o1', 'b1')).rejects.toThrow('bookings.CHANGE_TERM_NO_LONGER_FREE');
    expect(prisma.bookingChangeRequest.updateMany).not.toHaveBeenCalled();
  });

  it('expires a request whose new term has begun', async () => {
    const { service, prisma, events } = withPending(bookingRow(), { newStartsAt: new Date(Date.now() - HOUR) });
    await expect(service.approve('o1', 'b1')).rejects.toThrow('bookings.CHANGE_EXPIRED');
    expect(prisma.bookingChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'EXPIRED' }),
    });
    expect(events.emit).toHaveBeenCalledWith('booking.change_expired', { bookingId: 'b1', changeRequestId: 'c1' });
  });

  it('lets only the owner answer, and rejects with the reason', async () => {
    const { service, prisma, events } = withPending();
    await expect(service.approve('g1', 'b1')).rejects.toThrow();
    await service.reject('o1', 'b1', { reason: '  Zauzeto je  ' });
    expect(prisma.bookingChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'REJECTED', ownerReason: 'Zauzeto je', decidedByUserId: 'o1' }),
    });
    expect(events.emit).toHaveBeenCalledWith('booking.change_rejected', { bookingId: 'b1', changeRequestId: 'c1' });
  });

  it('lets the guest withdraw a waiting request', async () => {
    const { service, prisma, events } = withPending();
    await service.withdraw('g1', 'b1');
    expect(prisma.bookingChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'WITHDRAWN', decidedByUserId: 'g1' }),
    });
    expect(events.emit).toHaveBeenCalledWith('booking.change_withdrawn', { bookingId: 'b1', changeRequestId: 'c1' });
  });
});

describe('BookingChangesService#expireUnanswered (T136)', () => {
  it('expires requests past the response window or a started term, and closes silently those of closed bookings', async () => {
    const now = Date.now();
    const request = (id: string, status: string, createdAgoHours: number) => ({
      id,
      bookingId: `b-${id}`,
      status: 'PENDING',
      createdAt: new Date(now - createdAgoHours * HOUR),
      oldStartsAt: new Date(now + 100 * HOUR),
      newStartsAt: new Date(now + 200 * HOUR),
      booking: { status },
    });
    const prisma: any = {
      setting: { findUnique: jest.fn().mockResolvedValue({ value: 48 }) },
      bookingChangeRequest: {
        findMany: jest.fn().mockResolvedValue([request('due', 'CONFIRMED', 49), request('fresh', 'CONFIRMED', 2), request('closed', 'CANCELLED', 1)]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(({ where }) => Promise.resolve({ bookingId: `b-${where.id}` })),
      },
    };
    const events = { emit: jest.fn() };
    const service = new BookingChangesService(prisma, {} as any, {} as any, i18n as any, events as any);
    await service.expireUnanswered();
    const expired = prisma.bookingChangeRequest.updateMany.mock.calls.map((call: any) => call[0].where.id);
    expect(expired).toEqual(['due', 'closed']);
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('booking.change_expired', { bookingId: 'b-due', changeRequestId: 'due' });
  });
});

describe('describeBookingChange (T136)', () => {
  const base = { status: 'CONFIRMED' as const, startsAt: new Date(Date.now() + 100 * HOUR) };
  const req = (status: string, createdAgo: number, extra: Record<string, any> = {}) =>
    ({
      id: status,
      status,
      createdAt: new Date(Date.now() - createdAgo * HOUR),
      oldStartsAt: new Date(),
      oldEndsAt: new Date(),
      newStartsAt: new Date(),
      newEndsAt: new Date(),
      oldTotalAmount: 100n,
      newTotalAmount: 200n,
      newAmountDue: 50n,
      newFees: { priceLines: [] },
      guestMessage: null,
      ownerReason: null,
      decidedAt: null,
      ...extra,
    }) as any;

  it('lets the guest ask while the listing takes bookings, nothing waits and the deadline is ahead', () => {
    const options = { deadlineHours: 48, listingBookable: true, asGuest: true };
    expect(describeBookingChange(base, [], options).canRequest).toBe(true);
    expect(describeBookingChange(base, [req('PENDING', 1)], options)).toMatchObject({ canRequest: false, pending: { id: 'PENDING' } });
    expect(describeBookingChange({ ...base, startsAt: new Date(Date.now() + 47 * HOUR) }, [], options)).toMatchObject({
      canRequest: false,
      deadlinePassed: true,
    });
    expect(describeBookingChange(base, [], { ...options, listingBookable: false }).canRequest).toBe(false);
    expect(describeBookingChange(base, [], { ...options, asGuest: false }).canRequest).toBe(false);
    expect(describeBookingChange({ ...base, status: 'COMPLETED' }, [], options).canRequest).toBe(false);
  });

  it('shows the last decision unless a newer request waits', () => {
    const options = { deadlineHours: 48, listingBookable: true, asGuest: true };
    expect(describeBookingChange(base, [req('REJECTED', 5, { ownerReason: 'Ne' })], options).last).toMatchObject({ status: 'REJECTED', ownerReason: 'Ne' });
    expect(describeBookingChange(base, [req('REJECTED', 5), req('PENDING', 1)], options).last).toBeNull();
  });

  it('expires an unanswered request after the response window or when a term starts', () => {
    const createdAt = new Date('2026-10-10T10:00:00Z');
    expect(
      getChangeExpiresAt({ createdAt, oldStartsAt: new Date('2026-10-20T10:00:00Z'), newStartsAt: new Date('2026-10-25T10:00:00Z') }, 48),
    ).toEqual(new Date('2026-10-12T10:00:00Z'));
    expect(
      getChangeExpiresAt({ createdAt, oldStartsAt: new Date('2026-10-11T10:00:00Z'), newStartsAt: new Date('2026-10-25T10:00:00Z') }, 48),
    ).toEqual(new Date('2026-10-11T10:00:00Z'));
  });
});
