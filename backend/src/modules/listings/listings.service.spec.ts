import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    getFactKeys: jest.fn().mockResolvedValue({ cardFactKeys: ['kapacitet_dece'], listingFactKeys: ['kapacitet_dece'] }),
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
      phoneMasked: undefined,
      listingCount: 3,
    });
    for (const field of ['user', 'address', 'icalExportToken', 'subscription', 'subscriptionId', 'wizardStep', 'viewCount', 'deletedAt', 'pendingCategoryAssignment']) {
      expect(page).not.toHaveProperty(field);
    }
    expect(JSON.stringify(page)).not.toContain('Petrović');
    expect(page).toMatchObject({ title: 'Igraonica', canBook: true, canMessage: true, price: 3500 });
  });

  it('offers the phone masked when the package has no messaging, never the number (R108, T134)', async () => {
    const page: any = await setup(false).getPublicBySlug('igraonica');
    expect(page.owner.phoneMasked).toBe('064 *** ***');
    expect(page.owner).not.toHaveProperty('phone');
    expect(JSON.stringify(page)).not.toContain('123 4567');
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

describe('ListingsService#revealOwnerPhone (T134)', () => {
  function setup(row: Record<string, any> | null) {
    const prisma = { listing: { findUnique: jest.fn().mockResolvedValue(row) } };
    return { service: makeService(prisma), prisma };
  }
  const basic = {
    status: 'ACTIVE',
    user: { phone: ' 064 123 4567 ' },
    subscription: { package: { hasMessaging: false } },
  };

  it('gives a live Basic listing’s number', async () => {
    const { service, prisma } = setup(basic);
    await expect(service.revealOwnerPhone('igraonica')).resolves.toEqual({ phone: '064 123 4567' });
    expect(prisma.listing.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'igraonica' } }));
  });

  it('gives nothing for a listing that is not live, or that is gone', async () => {
    await expect(setup({ ...basic, status: 'PAUSED' }).service.revealOwnerPhone('igraonica')).rejects.toThrow(
      'errors.LISTING_NOT_FOUND',
    );
    await expect(setup(null).service.revealOwnerPhone('igraonica')).rejects.toThrow('errors.LISTING_NOT_FOUND');
  });

  it('gives nothing when the package has messaging or the owner has no number', async () => {
    const messaging = { ...basic, subscription: { package: { hasMessaging: true } } };
    await expect(setup(messaging).service.revealOwnerPhone('igraonica')).rejects.toThrow(
      'errors.OWNER_PHONE_NOT_AVAILABLE',
    );
    await expect(
      setup({ ...basic, user: { phone: null } }).service.revealOwnerPhone('igraonica'),
    ).rejects.toThrow('errors.OWNER_PHONE_NOT_AVAILABLE');
  });
});

describe('ListingsService#updateListing keeps one way of booking (T140, T126, T138, T129)', () => {
  const playroom = { id: 'c1', slug: 'igraonice', defaultBookingModel: 'PER_SLOT' };
  const hall = { id: 'c-hall', slug: 'sale-za-proslave', defaultBookingModel: 'PER_SLOT' };
  const ownRows = { where: { listingId: 'l1' } };
  // T129: what each category offers, as migration 20261010190000 sets it.
  const OFFERED: Record<string, Array<{ key: string; priceUnits: string[] }>> = {
    igraonice: [
      { key: 'DEFINED_SLOTS', priceUnits: ['SLOT'] },
      { key: 'WORKING_HOURS', priceUnits: ['HOUR'] },
      { key: 'CONTACT', priceUnits: [] },
    ],
    'sale-za-proslave': [
      { key: 'DEFINED_SLOTS', priceUnits: ['SLOT', 'GUEST'] },
      { key: 'CONTACT', priceUnits: [] },
    ],
    ostalo: [
      { key: 'DAY', priceUnits: ['DAY'] },
      { key: 'NIGHT', priceUnits: ['NIGHT'] },
      { key: 'MONTH', priceUnits: ['MONTH'] },
      { key: 'CONTACT', priceUnits: [] },
    ],
    'putnicka-vozila': [
      { key: 'DAY', priceUnits: ['DAY'] },
      { key: 'CONTACT', priceUnits: [] },
    ],
  };

  function setup(row: Record<string, any>, options: { category?: any; futureBookings?: number; lowestSlot?: bigint | null } = {}) {
    const deleteMany = () => jest.fn(async () => ({ count: 0 }));
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn(async ({ data }: any) => ({ ...row, ...data })),
      },
      category: { findUniqueOrThrow: jest.fn().mockResolvedValue(options.category ?? playroom) },
      booking: { count: jest.fn().mockResolvedValue(options.futureBookings ?? 0) },
      definedSlot: {
        aggregate: jest.fn().mockResolvedValue({ _min: { price: options.lowestSlot ?? null } }),
        deleteMany: deleteMany(),
      },
      workingHours: { deleteMany: deleteMany() },
      hourlyPriceRange: { deleteMany: deleteMany() },
      slotPriceOverride: { deleteMany: deleteMany() },
      datePriceOverride: { deleteMany: deleteMany() },
      $transaction: jest.fn(async (writes: Promise<unknown>[]) => Promise.all(writes)),
    };
    const slug = options.category?.slug ?? row.category?.slug ?? playroom.slug;
    const taxonomy = { getOfferedBookingModels: jest.fn().mockResolvedValue(OFFERED[slug] ?? []) };
    return { prisma, service: makeService(prisma, taxonomy) };
  }

  const hoursRow = listingRow({
    bookingModel: 'PER_SLOT',
    slotSubmode: 'WORKING_HOURS',
    priceUnit: 'HOUR',
    price: 11100n,
    weekendPrice: 15000n,
    minDuration: 2,
    maxDuration: 6,
    gapAfterMinutes: 30,
  });
  const slotsRow = listingRow({ bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', priceUnit: 'SLOT', price: 6000000n });

  it('moves a listing from working hours to slots: the hours and their prices go, its slots set the price', async () => {
    const { prisma, service } = setup(hoursRow, { lowestSlot: 6000000n });

    const saved = await service.updateListing('u1', 'l1', {
      slotSubmode: 'DEFINED_SLOTS',
      priceUnit: 'SLOT',
      price: 111,
      minDuration: 2,
      maxDuration: 6,
    } as any);

    for (const table of ['workingHours', 'hourlyPriceRange', 'slotPriceOverride'] as const) {
      expect(prisma[table].deleteMany).toHaveBeenCalledWith(ownRows);
    }
    expect(prisma.definedSlot.deleteMany).not.toHaveBeenCalled();
    expect(prisma.datePriceOverride.deleteMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.listing.update.mock.calls[0][0].data).toMatchObject({
      slotSubmode: 'DEFINED_SLOTS',
      price: 6000000n,
      weekendPrice: null,
      minDuration: null,
      maxDuration: null,
      gapAfterMinutes: null,
    });
    expect(prisma.definedSlot.aggregate.mock.calls[0][0].where).toMatchObject({ listingId: 'l1', price: { not: null } });
    expect(saved.price).toBe(60000);
  });

  it('moves a listing from slots to working hours: the slots and their template go, the price is the one typed', async () => {
    const { prisma, service } = setup(slotsRow);

    await service.updateListing('u1', 'l1', { slotSubmode: 'WORKING_HOURS', priceUnit: 'HOUR', price: 2000 } as any);

    expect(prisma.definedSlot.deleteMany).toHaveBeenCalledWith(ownRows);
    expect(prisma.workingHours.deleteMany).not.toHaveBeenCalled();
    expect(prisma.listing.update.mock.calls[0][0].data).toMatchObject({
      slotSubmode: 'WORKING_HOURS',
      price: 200000n,
      slotTemplate: Prisma.DbNull,
    });
  });

  it('keeps the way while a booking is ahead and changes nothing', async () => {
    const { prisma, service } = setup(hoursRow, { futureBookings: 1 });

    await expect(service.updateListing('u1', 'l1', { slotSubmode: 'DEFINED_SLOTS', priceUnit: 'SLOT' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('errors.SLOT_MODE_LOCKED_BY_BOOKINGS');
    expect(prisma.booking.count.mock.calls[0][0].where).toEqual({
      listingId: 'l1',
      status: { in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'] },
      endsAt: { gt: expect.any(Date) },
    });
    expect(prisma.listing.update).not.toHaveBeenCalled();
    expect(prisma.workingHours.deleteMany).not.toHaveBeenCalled();
  });

  it('saves the first way without looking for bookings, and the same way without deleting anything', async () => {
    const first = setup(listingRow({ bookingModel: 'PER_SLOT', slotSubmode: null, priceUnit: 'HOUR' }), { futureBookings: 1 });
    await first.service.updateListing('u1', 'l1', { slotSubmode: 'WORKING_HOURS' } as any);
    expect(first.prisma.booking.count).not.toHaveBeenCalled();
    expect(first.prisma.listing.update).toHaveBeenCalled();

    const same = setup(hoursRow, { futureBookings: 1 });
    await same.service.updateListing('u1', 'l1', { slotSubmode: 'WORKING_HOURS', price: 1500 } as any);
    expect(same.prisma.$transaction).not.toHaveBeenCalled();
    expect(same.prisma.workingHours.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps a party hall on its defined slots, the only model it is offered', async () => {
    const { prisma, service } = setup(slotsRow, { category: hall });

    await expect(service.updateListing('u1', 'l1', { slotSubmode: 'WORKING_HOURS' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('errors.BOOKING_MODEL_NOT_OFFERED');
    expect(prisma.listing.update).not.toHaveBeenCalled();
    await expect(service.updateListing('u1', 'l1', { slotSubmode: 'DEFINED_SLOTS', priceUnit: 'GUEST' } as any)).resolves.toBeDefined();
  });

  it('keeps a listing on slots at its cheapest slot ahead, whatever the hidden price field sends', async () => {
    const { prisma, service } = setup(slotsRow, { lowestSlot: 450000n });

    await service.updateListing('u1', 'l1', { description: 'Novi opis', price: 111, minDuration: 3 } as any);

    expect(prisma.listing.update.mock.calls[0][0].data).toMatchObject({ price: 450000n, minDuration: null });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('moves a listing only to a model its category offers, and lets one keep its own (T126, T129)', async () => {
    // A stay by the hour stands for no model; the listing still on it saves as it is.
    const row = listingRow({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'HOUR', category: { slug: 'putnicka-vozila' } });
    const { prisma, service } = setup(row);

    await expect(service.updateListing('u1', 'l1', { priceUnit: 'NIGHT' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('errors.BOOKING_MODEL_NOT_OFFERED');
    await expect(service.updateListing('u1', 'l1', { description: 'Novi opis', priceUnit: 'HOUR' } as any)).resolves.toBeDefined();
    await expect(service.updateListing('u1', 'l1', { priceUnit: 'DAY' } as any)).resolves.toBeDefined();
    await expect(service.updateListing('u1', 'l1', { bookingModel: 'NO_BOOKING' } as any)).resolves.toBeDefined();
    expect(prisma.listing.update).toHaveBeenCalledTimes(3);
  });

  it('lets a listing keep a model taken away from its category (T129)', async () => {
    const { prisma, service } = setup(hoursRow, { category: hall });
    await expect(service.updateListing('u1', 'l1', { slotSubmode: 'WORKING_HOURS', price: 1500 } as any)).resolves.toBeDefined();
    expect(prisma.listing.update).toHaveBeenCalled();
  });

  it("drops a stay's date prices between nights and months, not between nights and days", async () => {
    const night = listingRow({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'NIGHT', category: { slug: 'ostalo' } });
    const toMonth = setup(night);
    await toMonth.service.updateListing('u1', 'l1', { priceUnit: 'MONTH' } as any);
    expect(toMonth.prisma.datePriceOverride.deleteMany).toHaveBeenCalledWith(ownRows);
    expect(toMonth.prisma.$transaction).toHaveBeenCalledTimes(1);

    const toDay = setup(night);
    await toDay.service.updateListing('u1', 'l1', { priceUnit: 'DAY' } as any);
    expect(toDay.prisma.datePriceOverride.deleteMany).not.toHaveBeenCalled();

    const fromMonth = setup(listingRow({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'MONTH', category: { slug: 'ostalo' } }));
    await fromMonth.service.updateListing('u1', 'l1', { priceUnit: 'NIGHT' } as any);
    expect(fromMonth.prisma.datePriceOverride.deleteMany).toHaveBeenCalledWith(ownRows);
  });

  it('tells the wizard whether a booking is ahead', async () => {
    const { prisma, service } = setup(hoursRow, { futureBookings: 2 });
    await expect(service.getOwned('u1', 'l1')).resolves.toMatchObject({ hasFutureBookings: true, price: 111 });
    prisma.booking.count.mockResolvedValue(0);
    await expect(service.getOwned('u1', 'l1')).resolves.toMatchObject({ hasFutureBookings: false });
  });

  it('takes no stay by the hour from the proposal form either (T126)', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'u1', restrictedUntil: null }) },
      category: { findUniqueOrThrow: jest.fn() },
      listing: { create: jest.fn() },
    };
    const service = makeService(prisma);
    await expect(
      service.createUncategorizedListing('u1', { title: 'Kombi', bookingModel: 'PER_STAY', priceUnit: 'HOUR' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createUncategorizedListing('u1', { title: 'Sala', bookingModel: 'PER_SLOT', priceUnit: 'DAY' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});

describe('ListingsService#sendPriceDropNotifications', () => {
  it('tells about a lower price, not about a listing on slots with none ahead (T121)', async () => {
    const favorite = (listingId: string, price: bigint) => ({
      userId: 'g1',
      listingId,
      priceAtAdd: 4500000n,
      listing: { id: listingId, price, status: 'ACTIVE', title: 'Sala', slug: listingId },
    });
    const prisma = {
      favorite: {
        findMany: jest.fn().mockResolvedValue([favorite('cheaper', 4000000n), favorite('no-slots', 0n), favorite('same', 4500000n)]),
        update: jest.fn(),
      },
    };
    const events = { emit: jest.fn() };
    const service = new ListingsService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, i18n as any, events as any);

    await service.sendPriceDropNotifications();

    expect(events.emit.mock.calls).toEqual([['listing.favorite_price_dropped', { userId: 'g1', listingId: 'cheaper' }]]);
    expect(prisma.favorite.update).toHaveBeenCalledTimes(1);
  });
});

describe('ListingsService#upsertAttributes, hidden fields and items (T129)', () => {
  const attributes = [
    { id: 'a-sobe', key: 'broj_soba', type: 'NUMBER', hidden: true, options: [] },
    { id: 'a-novo', key: 'parking', type: 'BOOLEAN', hidden: true, options: [] },
    {
      id: 'a-sadrzaji',
      key: 'sadrzaji',
      type: 'CHECKBOX_GROUP',
      hidden: false,
      options: [
        { id: 'o-wifi', key: 'wifi', hidden: false },
        { id: 'o-bazen', key: 'bazen', hidden: true },
        { id: 'o-sauna', key: 'sauna', hidden: true },
      ],
    },
  ];

  function setup(stored: Array<{ attributeId: string; valueOptionIds: string[] }>) {
    const prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue(listingRow({ userId: 'u1' })) },
      listingAttribute: {
        findMany: jest.fn().mockResolvedValue(stored),
        upsert: jest.fn((args) => args),
        deleteMany: jest.fn((args) => args),
      },
      $transaction: jest.fn(async (ops) => ops),
    };
    const service = makeService(prisma, { resolveAttributesForCategory: jest.fn().mockResolvedValue(attributes) });
    return { prisma, service };
  }

  it('keeps a hidden field the listing has, takes it from no other and drops hidden or foreign items', async () => {
    const { prisma, service } = setup([
      { attributeId: 'a-sobe', valueOptionIds: [] },
      { attributeId: 'a-sadrzaji', valueOptionIds: ['o-bazen'] },
    ]);
    await service.upsertAttributes('u1', 'l1', {
      values: [
        { attributeId: 'a-sobe', valueNumber: 3 },
        { attributeId: 'a-novo', valueBoolean: true },
        { attributeId: 'a-sadrzaji', valueOptionIds: ['o-wifi', 'o-bazen', 'o-sauna', 'o-tudji'] },
      ],
    });

    const written = prisma.listingAttribute.upsert.mock.calls.map(([args]) => [args.where.listingId_attributeId.attributeId, args.update]);
    expect(written).toEqual([
      ['a-sobe', expect.objectContaining({ valueNumber: 3 })],
      // Bazen stays (the listing had it), Sauna is hidden and new, o-tudji is not this field's.
      ['a-sadrzaji', expect.objectContaining({ valueOptionIds: ['o-wifi', 'o-bazen'] })],
    ]);
  });
});

describe('ListingsService#updateLocation (T119)', () => {
  const SURDUK = { id: 'c-surduk', name: 'Surduk', municipality: 'Stara Pazova', regionId: 'r-srem', hidden: false };
  const dto = { regionId: 'r-old', cityId: 'c-surduk', address: 'Glavna 1' };

  function serviceWith({ city = SURDUK, areas = [] as any[], listing = {} as any } = {}) {
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({ id: 'l1', userId: 'u1', cityId: null, cityAreaId: null, ...listing }),
        update: jest.fn(({ data }) => Promise.resolve(listingRow(data))),
      },
      city: { findUniqueOrThrow: jest.fn().mockResolvedValue(city) },
      cityArea: { findMany: jest.fn().mockResolvedValue(areas) },
    };
    const geocoding = { geocode: jest.fn().mockResolvedValue({ latitude: 45.07, longitude: 20.08 }) };
    const service = new ListingsService(prisma as any, {} as any, {} as any, geocoding as any, {} as any, {} as any, i18n as any, {} as any);
    return { service, prisma, geocoding };
  }

  it('takes the okrug from the place and geocodes the place with its municipality', async () => {
    const { service, prisma, geocoding } = serviceWith();
    await service.updateLocation('u1', 'l1', dto);
    expect(prisma.listing.update.mock.calls[0][0].data).toMatchObject({ regionId: 'r-srem', cityId: 'c-surduk', cityAreaId: null });
    expect(geocoding.geocode).toHaveBeenCalledWith('Glavna 1', 'Surduk, Stara Pazova');
  });

  it('refuses a hidden place for a new choice and keeps it for a listing that has it', async () => {
    const hidden = { ...SURDUK, hidden: true };
    await expect(serviceWith({ city: hidden }).service.updateLocation('u1', 'l1', dto)).rejects.toThrow('errors.PLACE_HIDDEN');
    const { service, prisma } = serviceWith({ city: hidden, listing: { cityId: 'c-surduk' } });
    await service.updateLocation('u1', 'l1', dto);
    expect(prisma.listing.update).toHaveBeenCalled();
  });

  it('needs a part of the city only when one is offered, and takes a hidden part from no new listing', async () => {
    const areas = [{ id: 'a-old', hidden: true }];
    // Only a hidden part: nothing to pick, so none is needed.
    await serviceWith({ areas }).service.updateLocation('u1', 'l1', dto);
    await expect(serviceWith({ areas }).service.updateLocation('u1', 'l1', { ...dto, cityAreaId: 'a-old' })).rejects.toThrow(
      'errors.CITY_AREA_HIDDEN',
    );
    await serviceWith({ areas, listing: { cityId: 'c-surduk', cityAreaId: 'a-old' } }).service.updateLocation('u1', 'l1', {
      ...dto,
      cityAreaId: 'a-old',
    });
    await expect(
      serviceWith({ areas: [...areas, { id: 'a-new', hidden: false }] }).service.updateLocation('u1', 'l1', dto),
    ).rejects.toThrow('errors.CITY_AREA_REQUIRED');
  });
});
