import { BadRequestException } from '@nestjs/common';
import { ListingsService } from './listings.service';

const i18n = { t: jest.fn((key: string) => key) };

function makeService(prisma: any, taxonomy: any = {}) {
  return new ListingsService(prisma, {} as any, {} as any, {} as any, taxonomy, {} as any, i18n as any, {} as any);
}

function listingRow(overrides: Record<string, any>) {
  return {
    id: 'l1',
    userId: 'u1',
    categoryId: 'c1',
    status: 'ACTIVE',
    title: 'Igraonica',
    price: 350000n,
    weekendPrice: null,
    pricePerGuest: null,
    pendingCategoryAssignment: false,
    photos: [],
    category: { id: 'c1', slug: 'igraonice' },
    city: null,
    cityArea: null,
    subscription: null,
    moderations: [],
    bankedDays: [],
    ...overrides,
  };
}

describe('ListingsService#getMine (Dizajn 32)', () => {
  const taxonomy = { getCategoryNames: jest.fn().mockResolvedValue(new Map([['c1', 'Igraonice']])) };

  it('adds what a Moji oglasi row shows to every listing', async () => {
    const submittedAt = new Date('2026-09-02T10:00:00Z');
    const rejectedAt = new Date('2026-09-05T10:00:00Z');
    const prisma = {
      listing: {
        findMany: jest.fn().mockResolvedValue([
          listingRow({
            id: 'active',
            photos: [{ url: 'cover.jpg' }],
            city: { name: 'Beograd' },
            cityArea: { name: 'Vračar' },
            subscription: { package: { key: 'STANDARD' }, status: 'ACTIVE', expiresAt: new Date('2026-10-01T00:00:00Z') },
            moderations: [{ createdAt: submittedAt, rejectionReason: null, note: null }],
          }),
          listingRow({ id: 'pending', status: 'PENDING_APPROVAL', moderations: [{ createdAt: submittedAt, rejectionReason: null, note: null }] }),
          listingRow({
            id: 'rejected',
            status: 'REJECTED',
            moderations: [{ createdAt: rejectedAt, rejectionReason: 'MISSING_PHOTOS', note: 'Dodajte fotografije sale' }],
          }),
          listingRow({
            id: 'banked',
            bookingModel: 'PER_STAY',
            priceUnit: 'NIGHT',
            subscription: { package: { key: 'STANDARD', hasIcal: true }, status: 'EXPIRED', expiresAt: new Date('2026-09-01T00:00:00Z') },
            bankedDays: [{ validUntil: new Date('2026-09-20T00:00:00Z') }, { validUntil: new Date('2026-08-01T00:00:00Z') }],
          }),
        ]),
      },
      booking: {
        groupBy: jest.fn().mockResolvedValue([
          { listingId: 'active', status: 'CONFIRMED', _count: { _all: 5 } },
          { listingId: 'active', status: 'COMPLETED', _count: { _all: 7 } },
          { listingId: 'active', status: 'REQUESTED', _count: { _all: 3 } },
          { listingId: 'banked', status: 'AWAITING_PAYMENT', _count: { _all: 1 } },
        ]),
      },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = makeService(prisma, taxonomy);

    const [active, pending, rejected, banked] = await service.getMine('u1');

    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', status: { not: 'DELETED' } });
    expect(prisma.booking.groupBy.mock.calls[0][0].where).toEqual({
      listingId: { in: ['active', 'pending', 'rejected', 'banked'] },
      status: { in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED'] },
    });
    expect(active).toMatchObject({
      id: 'active',
      price: 3500,
      categoryName: 'Igraonice',
      cityName: 'Beograd',
      cityAreaName: 'Vračar',
      coverPhotoUrl: 'cover.jpg',
      submittedAt: null,
      rejection: null,
      validUntil: new Date('2026-10-01T00:00:00Z'),
      bookings: { confirmed: 12, requested: 3, awaitingPayment: 0 },
      icalAvailable: false,
    });
    expect(active).not.toHaveProperty('moderations');
    expect(active).not.toHaveProperty('bankedDays');
    expect(pending).toMatchObject({ submittedAt, rejection: null, coverPhotoUrl: null, validUntil: null });
    expect(rejected).toMatchObject({
      submittedAt: null,
      rejection: { reason: 'MISSING_PHOTOS', note: 'Dodajte fotografije sale' },
      bookings: { confirmed: 0, requested: 0, awaitingPayment: 0 },
    });
    // Online on banked days after the package itself ran out.
    expect(banked).toMatchObject({
      validUntil: new Date('2026-09-20T00:00:00Z'),
      bookings: { confirmed: 0, requested: 0, awaitingPayment: 1 },
      // Dizajn 33: a published stay whose package includes iCal.
      icalAvailable: true,
    });
    expect(pending.icalAvailable).toBe(false);
  });

  it('skips the bookings query for an owner without listings', async () => {
    const prisma = {
      listing: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { groupBy: jest.fn() },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await expect(makeService(prisma, taxonomy).getMine('u1')).resolves.toEqual([]);
    expect(prisma.booking.groupBy).not.toHaveBeenCalled();
  });

  it('keeps a listing online through paid renewals and carried-over days', async () => {
    const prisma = {
      listing: {
        findMany: jest.fn().mockResolvedValue([
          listingRow({
            id: 'renewed',
            subscriptionId: 's1',
            subscription: { package: { key: 'STANDARD' }, status: 'ACTIVE', expiresAt: new Date('2026-10-01T00:00:00Z') },
          }),
          listingRow({
            id: 'carried',
            subscriptionId: 's2',
            subscription: { package: { key: 'PRO' }, status: 'ACTIVE', expiresAt: new Date('2026-10-01T00:00:00Z') },
            bankedDays: [{ validUntil: null, days: 5 }, { validUntil: null, days: 7 }],
          }),
        ]),
      },
      booking: { groupBy: jest.fn().mockResolvedValue([]) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          // Two periods paid in advance, the second continuing the first.
          { id: 'r2', renewsSubscriptionId: 'r1', expiresAt: new Date('2026-11-30T00:00:00Z') },
          { id: 'r1', renewsSubscriptionId: 's1', expiresAt: new Date('2026-10-31T00:00:00Z') },
        ]),
      },
    };
    const [renewed, carried] = await makeService(prisma, taxonomy).getMine('u1');

    expect(prisma.subscription.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', status: 'SCHEDULED' });
    expect(renewed).toMatchObject({ validUntil: new Date('2026-11-30T00:00:00Z'), renewalScheduled: true });
    // Twelve days wait for the Pro package to end.
    expect(carried).toMatchObject({ validUntil: new Date('2026-10-13T00:00:00Z'), renewalScheduled: false });
  });
});

describe('ListingsService#deleteListing', () => {
  it('refuses a listing with open bookings in the owner’s language', async () => {
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(listingRow({ paymentMethod: 'CASH' })),
        update: jest.fn(),
      },
      booking: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = makeService(prisma);

    const error = await service.deleteListing('u1', 'l1').catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('errors.LISTING_HAS_ACTIVE_BOOKINGS');
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });
});
