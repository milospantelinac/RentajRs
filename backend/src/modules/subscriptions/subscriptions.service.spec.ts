import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService#assertPackageCompatibleWithListing (Ch.11.2 package-tier enforcement)', () => {
  const i18n = { t: jest.fn((key: string) => key) };

  function makeService(prisma: any) {
    return new SubscriptionsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      i18n as any,
      {} as any,
      {} as any,
    );
  }

  beforeEach(() => i18n.t.mockClear());

  it('rejects a bookable listing when the package does not include bookings (Osnovni/BASIC)', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', bookingModel: 'PER_STAY' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', hasBookings: false }) },
    };
    const service = makeService(prisma);
    await expect(
      (service as any).assertPackageCompatibleWithListing('l1', 'p1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a bookable listing when the package includes bookings (Pro)', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', bookingModel: 'PER_STAY' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', hasBookings: true }) },
    };
    const service = makeService(prisma);
    await expect((service as any).assertPackageCompatibleWithListing('l1', 'p1')).resolves.toBeUndefined();
  });

  it('allows a NO_BOOKING listing on a package without bookings', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', bookingModel: 'NO_BOOKING' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', hasBookings: false }) },
    };
    const service = makeService(prisma);
    await expect((service as any).assertPackageCompatibleWithListing('l1', 'p1')).resolves.toBeUndefined();
  });
});

describe('SubscriptionsService#getMySubscriptions (Dizajn 35)', () => {
  function makeService(prisma: any) {
    return new SubscriptionsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  }

  const pro = { id: 'p1', key: 'PRO', listingLimit: 4, priceMonthly: 864_800n, priceYearly: 9_490_000n };

  it('leaves deleted listings out, as attachToExistingSubscription does when it counts places', async () => {
    const prisma = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', status: 'ACTIVE', priceAtPurchase: 864_800n, package: pro, listings: [{ id: 'l1', title: 'Sala', slug: 'sala' }] },
        ]),
      },
      bankedDay: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await makeService(prisma).getMySubscriptions('u1');

    const query = prisma.subscription.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: 'u1' });
    expect(query.include.listings.where).toEqual({ status: { not: 'DELETED' } });
  });

  it('returns prices in RSD and the unused banked days of each subscription', async () => {
    const banked = [
      { id: 'b1', listingId: 'l1', days: 12, validUntil: null },
      { id: 'b2', listingId: 'l9', days: 5, validUntil: null },
    ];
    const prisma = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', status: 'ACTIVE', priceAtPurchase: 864_800n, package: pro, listings: [{ id: 'l1', title: 'Sala', slug: 'sala' }] },
          { id: 's2', status: 'CANCELLED', priceAtPurchase: 334_000n, package: { ...pro, key: 'STANDARD' }, listings: [] },
        ]),
      },
      bankedDay: { findMany: jest.fn().mockResolvedValue(banked) },
    };
    const [active, cancelled] = await makeService(prisma).getMySubscriptions('u1');

    expect(prisma.bankedDay.findMany).toHaveBeenCalledWith({ where: { listingId: { in: ['l1'] }, usedAt: null } });
    expect(active.priceAtPurchase).toBe(8648);
    expect(active.package.priceMonthly).toBe(8648);
    expect(active.bankedDays).toEqual([banked[0]]);
    expect(cancelled.priceAtPurchase).toBe(3340);
    expect(cancelled.bankedDays).toEqual([]);
  });
});

describe('SubscriptionsService featured listings and the direct package purchase', () => {
  const i18n = { t: jest.fn((key: string) => key) };
  const taxonomy = {
    getCategoryNames: jest.fn(async () => new Map([['c1', 'Sobe']])),
    getOptionNames: jest.fn(async () => new Map()),
  };

  function makeService(prisma: any) {
    return new SubscriptionsService(prisma, {} as any, {} as any, taxonomy as any, {} as any, {} as any, i18n as any, {} as any, {} as any);
  }

  it('gives the public a live listing card, never the whole row', async () => {
    const row = {
      id: 'l1',
      slug: 'soba',
      title: 'Soba',
      price: 500_000n,
      priceUnit: 'NIGHT',
      avgRating: null,
      reviewCount: 0,
      bookingModel: 'PER_STAY',
      city: null,
      cityArea: null,
      category: { id: 'c1', slug: 'sobe', icon: 'bed', cardFactKeys: ['kapacitet_ljudi'], parent: null },
      photos: [],
      latitude: null,
      longitude: null,
      attributes: [],
      address: 'Tajna 7',
      icalExportToken: 'secret',
      userId: 'owner-1',
    };
    const prisma = { featuredListing: { findMany: jest.fn().mockResolvedValue([{ id: 'f1', listing: row }]) } };

    const cards = await makeService(prisma).getRotatedFeatured('c1');
    expect(prisma.featuredListing.findMany.mock.calls[0][0].where.listing).toEqual({ categoryId: 'c1', status: 'ACTIVE' });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ slug: 'soba', price: 5000, category: { name: 'Sobe' } });
    expect(JSON.stringify(cards)).not.toMatch(/Tajna 7|secret|owner-1/);
  });

  it('refuses a person a new package outside the card checkout', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', userId: 'u1', status: 'DRAFT', bookingModel: 'NO_BOOKING' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', key: 'PRO', hasBookings: true }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'u1', buyerType: 'PERSON' }) },
      subscription: { create: jest.fn() },
    };

    await expect(
      makeService(prisma).purchaseForListing('u1', { listingId: 'l1', packageId: 'p1', billingCycle: 'YEARLY' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('errors.PACKAGE_CHECKOUT_REQUIRED');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });
});
