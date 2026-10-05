import { BadRequestException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { LISTING_COUNTS_CACHE_KEY } from '../taxonomy/taxonomy.service';

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

describe('ListingsService keeps the category counts in step with search', () => {
  function makeCounted(prisma: any) {
    const cache = { del: jest.fn(async () => undefined) };
    const events = { emit: jest.fn() };
    const service = new ListingsService(prisma, cache as any, {} as any, {} as any, {} as any, {} as any, i18n as any, events as any);
    return { service, cache };
  }

  it('drops them when a listing is approved', async () => {
    const row = listingRow({ status: 'PENDING_APPROVAL', publishedAt: new Date('2026-08-01') });
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue({ ...row, status: 'ACTIVE' }) },
      listingModeration: { updateMany: jest.fn() },
    };
    const { service, cache } = makeCounted(prisma);

    await service.adminApprove('admin-1', 'l1');
    expect(cache.del).toHaveBeenCalledWith(LISTING_COUNTS_CACHE_KEY);
  });

  it('drops them when a listing is rejected, deleted or filed under another category', async () => {
    const row = listingRow({ bookingModel: 'PER_STAY', priceUnit: 'NIGHT', icalExportToken: 'token' });
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(row),
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      },
      listingModeration: { updateMany: jest.fn() },
      booking: { count: jest.fn().mockResolvedValue(0) },
      subscription: { deleteMany: jest.fn() },
      category: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'c2', defaultBookingModel: 'PER_STAY', allowedPriceUnits: ['NIGHT'], defaultPriceUnit: 'NIGHT' }),
      },
    };
    const { service, cache } = makeCounted(prisma);

    await service.adminReject('admin-1', 'l1', { reason: 'OTHER' } as any);
    expect(cache.del).toHaveBeenCalledTimes(1);
    await service.deleteListing('u1', 'l1');
    expect(cache.del).toHaveBeenCalledTimes(2);
    await service.adminAssignCategory('l1', 'c2');
    expect(cache.del).toHaveBeenCalledTimes(3);
    expect(cache.del.mock.calls).toEqual([[LISTING_COUNTS_CACHE_KEY], [LISTING_COUNTS_CACHE_KEY], [LISTING_COUNTS_CACHE_KEY]]);
  });

  it('drops them when the availability switch flips, and only then', async () => {
    const row = listingRow({ available: true });
    const prisma = { listing: { findUnique: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue(row) } };
    const { service, cache } = makeCounted(prisma);

    await service.updateListing('u1', 'l1', { available: true } as any);
    await service.updateListing('u1', 'l1', { description: 'Novi opis' } as any);
    expect(cache.del).not.toHaveBeenCalled();

    await service.updateListing('u1', 'l1', { available: false } as any);
    expect(cache.del).toHaveBeenCalledWith(LISTING_COUNTS_CACHE_KEY);
  });
});

describe('ListingsService takes a listing only into a published category (Dizajn 50)', () => {
  const ostalo = (published: boolean) => ({
    id: 'c-ost',
    slug: 'ostalo',
    status: 'ACTIVE',
    published,
    children: [],
    defaultBookingModel: 'PER_STAY',
    allowedPriceUnits: ['DAY', 'NIGHT', 'MONTH', 'HOUR', 'SLOT'],
    defaultPriceUnit: 'DAY',
  });

  it('refuses a new draft in a category that is not published', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'u1', restrictedUntil: null }) },
      category: { findUnique: jest.fn().mockResolvedValue(ostalo(false)) },
      listing: { create: jest.fn() },
    };
    await expect(makeService(prisma).createDraft('u1', { categoryId: 'c-ost' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it('moves a draft into Ostalo once it is published, and not before', async () => {
    const draft = listingRow({ status: 'DRAFT', bookingModel: 'PER_STAY', priceUnit: 'NIGHT', icalExportToken: 'token' });
    const update = jest.fn().mockResolvedValue({ ...draft, categoryId: 'c-ost' });
    const prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue(draft), update },
      listingAttribute: { deleteMany: jest.fn() },
      category: { findUnique: jest.fn().mockResolvedValue(ostalo(false)) },
      $transaction: jest.fn(async (writes: Promise<unknown>[]) => Promise.all(writes)),
    };
    const taxonomy = { resolveAttributesForCategory: jest.fn().mockResolvedValue([]) };
    const service = makeService(prisma, taxonomy);

    await expect(service.changeCategory('u1', 'l1', 'c-ost')).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();

    prisma.category.findUnique.mockResolvedValue(ostalo(true));
    await expect(service.changeCategory('u1', 'l1', 'c-ost')).resolves.toMatchObject({ categoryId: 'c-ost' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 'c-ost', priceUnit: 'NIGHT' }) }),
    );
  });
});

describe('ListingsService#getPublicBySlug (found in Dizajn 39)', () => {
  const owner = {
    id: 'u1',
    firstName: 'Marko',
    lastName: 'Petrović',
    avatarUrl: null,
    profileSlug: 'marko-petrovic',
    avgResponseTimeMinutes: 30,
    verified: true,
    createdAt: new Date('2024-03-01T00:00:00Z'),
    phone: '064 123 4567',
  };
  const taxonomy = {
    resolveAttributesForCategory: jest.fn().mockResolvedValue([]),
    getCategoryNames: jest.fn().mockResolvedValue(new Map([['c1', 'Igraonice']])),
    getCategoryTree: jest.fn().mockResolvedValue([{ id: 'c1', slug: 'igraonice', children: [] }]),
  };

  function setup(hasMessaging: boolean) {
    const row = listingRow({
      address: 'Njegoševa 12',
      icalExportToken: 'secret-token',
      subscriptionId: 's1',
      wizardStep: 9,
      viewCount: 120,
      deletedAt: null,
      faqs: [],
      extraServices: [],
      region: null,
      user: owner,
      subscription: { package: { hasBookings: true, hasMessaging } },
    });
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(row),
        count: jest.fn().mockResolvedValue(3),
        update: jest.fn().mockResolvedValue({}),
      },
      listingAttribute: { findMany: jest.fn().mockResolvedValue([]) },
      listingViewStat: { upsert: jest.fn().mockResolvedValue({}) },
    };
    return makeService(prisma, taxonomy);
  }

  it('sends the owner as the page names them and nothing the page does not show', async () => {
    const page: any = await setup(true).getPublicBySlug('igraonica');
    expect(page.owner).toEqual({
      id: 'u1',
      firstName: 'Marko',
      lastInitial: 'P',
      avatarUrl: null,
      profileSlug: 'marko-petrovic',
      avgResponseTimeMinutes: 30,
      verified: true,
      createdAt: owner.createdAt,
      phone: undefined,
      listingCount: 3,
    });
    for (const field of ['user', 'address', 'icalExportToken', 'subscription', 'subscriptionId', 'wizardStep', 'viewCount', 'deletedAt', 'pendingCategoryAssignment']) {
      expect(page).not.toHaveProperty(field);
    }
    expect(JSON.stringify(page)).not.toContain('Petrović');
    expect(page).toMatchObject({ title: 'Igraonica', canBook: true, canMessage: true, price: 3500 });
  });

  it('still gives the phone when the package has no messaging (R108)', async () => {
    const page: any = await setup(false).getPublicBySlug('igraonica');
    expect(page.owner.phone).toBe('064 123 4567');
    expect(page.canMessage).toBe(false);
  });

  it('names what the guests are counted in for the request form (Dizajn 40)', async () => {
    taxonomy.resolveAttributesForCategory.mockResolvedValueOnce([]).mockResolvedValueOnce([{ key: 'kapacitet_dece' }]);
    const page: any = await setup(true).getPublicBySlug('igraonica');
    expect(page.guestUnit).toBe('children');

    const plain: any = await setup(true).getPublicBySlug('igraonica');
    expect(plain.guestUnit).toBe('guests');
  });
});
