import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as grantModule from './featured-grant';
import { FeaturedService } from './featured.service';

const NOW = new Date('2026-10-23T10:00:00Z');

function card(id: string, ownerId: string) {
  return {
    id,
    userId: ownerId,
    slug: `oglas-${id}`,
    title: `Oglas ${id}`,
    price: 500_000n,
    priceUnit: 'NIGHT',
    avgRating: null,
    reviewCount: 0,
    bookingModel: 'PER_STAY',
    slotSubmode: null,
    city: null,
    cityArea: null,
    category: { id: 'sobe', slug: 'sobe', icon: 'bed', cardFactKeys: [], parent: null },
    photos: [],
    latitude: null,
    longitude: null,
    attributes: [],
    address: 'Tajna 7',
    icalExportToken: 'secret',
  };
}

function settings(values: Record<string, unknown>) {
  return { findUnique: jest.fn(async ({ where }: any) => (where.key in values ? { value: values[where.key] } : null)) };
}

function makeService(prisma: any, counts: Record<string, number> = {}) {
  const cache = {
    getOrSet: jest.fn(async (_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()),
    hashGetAll: jest.fn(async () => counts),
    hashIncrement: jest.fn(async () => undefined),
    del: jest.fn(),
  };
  const taxonomy = {
    getCategoryNames: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, `Kategorija ${id}`]))),
    getOptionNames: jest.fn(async () => new Map()),
  };
  const events = { emit: jest.fn() };
  const i18n = { t: jest.fn((key: string) => key) };
  const service = new FeaturedService(prisma, cache as any, taxonomy as any, events as any, i18n as any);
  return { service, cache, events };
}

afterEach(() => jest.restoreAllMocks());

describe('FeaturedService', () => {
  describe('the home page', () => {
    it('lists every featured listing as a public card, least shown first, and counts the first screen', async () => {
      const prisma = {
        setting: settings({ featured_rules: { homeDesktopCount: 2 } }),
        listing: { findMany: jest.fn().mockResolvedValue([card('l1', 'a'), card('l2', 'b'), card('l3', 'c')]) },
      };
      const { service, cache } = makeService(prisma, { 'l1:h': 5, 'l3:h': 2, 'l2:s': 9 });

      const home = await service.getHome(NOW);

      expect(home.listings.map((listing) => listing.id)).toEqual(['l2', 'l3', 'l1']);
      expect(home.listings.every((listing) => listing.featured)).toBe(true);
      expect(home).toMatchObject({ desktopCount: 2, phoneCount: 1, intervalSeconds: 5 });
      expect(JSON.stringify(home)).not.toMatch(/Tajna 7|secret/);
      expect(cache.hashIncrement).toHaveBeenCalledWith('featured:stats:2026-10-23', ['l2:h', 'l3:h'], expect.any(Number));
    });

    it('shows nothing while the main switch is off', async () => {
      const prisma = { setting: settings({ featured_rules: { enabled: false } }), listing: { findMany: jest.fn() } };
      const { service } = makeService(prisma);

      await expect(service.getHome(NOW)).resolves.toMatchObject({ listings: [] });
      expect(prisma.listing.findMany).not.toHaveBeenCalled();
    });
  });

  describe('the top of a search', () => {
    it("takes the search's own matches only, at most the set number, and counts their turn", async () => {
      const prisma = {
        setting: settings({ featured_rules: { searchTopCount: 2 } }),
        listing: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'l1', userId: 'a' },
            { id: 'l2', userId: 'b' },
            { id: 'l3', userId: 'c' },
          ]),
        },
      };
      const { service, cache } = makeService(prisma, { 'l1:s': 4, 'l2:s': 1, 'l3:s': 0 });
      const where = { categoryId: { in: ['sobe'] } };

      const picked = await service.pickForSearch(where, 24, NOW);

      expect(picked).toEqual(['l3', 'l2']);
      const query = prisma.listing.findMany.mock.calls[0][0];
      expect(query.where.AND[0]).toBe(where);
      expect(query.where.AND[1]).toMatchObject({ status: 'ACTIVE', available: true, user: { blocked: false } });
      expect(query.where.AND[2]).toEqual({ featuredPeriods: { some: { startsAt: { lte: NOW }, expiresAt: { gt: NOW } } } });
      expect(cache.hashIncrement).toHaveBeenCalledWith('featured:stats:2026-10-23', ['l3:s', 'l2:s'], expect.any(Number));
    });

    it('marks no card while featuring is switched off', async () => {
      const prisma = {
        setting: settings({ featured_rules: { enabled: false } }),
        featuredListing: { findMany: jest.fn().mockResolvedValue([{ listingId: 'l1' }]) },
      };
      const { service } = makeService(prisma);

      await expect(service.featuredAmong(['l1', 'l2'], NOW)).resolves.toEqual(new Set());
      expect(prisma.featuredListing.findMany).not.toHaveBeenCalled();
    });

    it('never takes more than the page holds', async () => {
      const prisma = {
        setting: settings({ featured_rules: { searchTopCount: 5 } }),
        listing: { findMany: jest.fn().mockResolvedValue(['a', 'b', 'c', 'd'].map((id) => ({ id, userId: id }))) },
      };
      const { service } = makeService(prisma);

      await expect(service.pickForSearch({}, 3, NOW)).resolves.toHaveLength(3);
    });
  });

  describe('the queue of a full category', () => {
    it('starts the oldest first and stops at a category that is still full', async () => {
      const requests = [
        { id: 'r1', listingId: 'l1', source: 'REQUEST', durationDays: 30, listing: { categoryId: 'stanovi' } },
        { id: 'r2', listingId: 'l2', source: 'LEADER', durationDays: 30, listing: { categoryId: 'stanovi' } },
        { id: 'r3', listingId: 'l3', source: 'ADMIN', durationDays: 15, listing: { categoryId: 'kuce' } },
      ];
      const prisma = { featuredRequest: { findMany: jest.fn().mockResolvedValue(requests), update: jest.fn() } };
      const grant = jest.spyOn(grantModule, 'grantFeatured').mockImplementation(async (_p, _e, _i, input) =>
        input.requestId === 'r1'
          ? { status: 'WAITING', requestId: 'r1', alreadyWaiting: true }
          : { status: 'STARTED', featuredId: 'f3', expiresAt: NOW },
      );
      const { service } = makeService(prisma);

      await service.promoteWaiting(undefined, NOW);

      expect(grant.mock.calls.map((call) => call[3].requestId)).toEqual(['r1', 'r3']);
      expect(grant.mock.calls[1][3]).toMatchObject({ listingId: 'l3', source: 'ADMIN', days: 15 });
    });

    it('cancels a waiting request whose listing can no longer be featured', async () => {
      const requests = [{ id: 'r1', listingId: 'l1', source: 'REQUEST', durationDays: 30, listing: { categoryId: 'stanovi' } }];
      const prisma = { featuredRequest: { findMany: jest.fn().mockResolvedValue(requests), update: jest.fn() } };
      jest.spyOn(grantModule, 'grantFeatured').mockRejectedValue(new BadRequestException('errors.FEATURED_LISTING_NOT_ACTIVE'));
      const { service } = makeService(prisma);

      await service.promoteWaiting(undefined, NOW);

      expect(prisma.featuredRequest.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'CANCELLED', decisionNote: 'errors.FEATURED_LISTING_NOT_ACTIVE' },
      });
    });
  });

  describe('leaders', () => {
    function leaderPrisma(options: { override?: boolean | null; firstPublishedAt?: Date | null; used?: number }) {
      return {
        setting: settings({ featured_leaders: { cutoffDate: '2026-11-30', days: 45 } }),
        user: { findUnique: jest.fn().mockResolvedValue({ leaderOverride: options.override ?? null }) },
        listing: { aggregate: jest.fn().mockResolvedValue({ _min: { publishedAt: options.firstPublishedAt ?? null } }) },
        featuredListing: { count: jest.fn().mockResolvedValue(options.used ?? 0) },
        featuredRequest: { count: jest.fn().mockResolvedValue(0) },
      };
    }

    it("starts a leader's free period when their listing goes live", async () => {
      const grant = jest
        .spyOn(grantModule, 'grantFeatured')
        .mockResolvedValue({ status: 'STARTED', featuredId: 'f1', expiresAt: NOW });
      const { service } = makeService(leaderPrisma({ firstPublishedAt: new Date('2026-11-02T09:00:00Z') }));

      await service.onListingApproved({ listingId: 'l1', userId: 'u1' });

      expect(grant).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), {
        listingId: 'l1',
        source: 'LEADER',
        days: 45,
      });
    });

    it.each([
      ['who used it already', { firstPublishedAt: new Date('2026-11-02T09:00:00Z'), used: 1 }],
      ['who started after the cutoff', { firstPublishedAt: new Date('2026-12-05T09:00:00Z') }],
      ['kept out by the admin', { override: false, firstPublishedAt: new Date('2026-11-02T09:00:00Z') }],
    ])('gives nothing to an owner %s', async (_name, options) => {
      const grant = jest.spyOn(grantModule, 'grantFeatured');
      const { service } = makeService(leaderPrisma(options));

      await service.onListingApproved({ listingId: 'l1', userId: 'u1' });

      expect(grant).not.toHaveBeenCalled();
    });
  });

  describe('the emails of a period', () => {
    const DAY = 86_400_000;

    it('reminds once, a week before a month ends and two days before a week ends', async () => {
      const periods = [
        { id: 'month-in-6-days', durationDays: 30, expiresAt: new Date(NOW.getTime() + 6 * DAY) },
        { id: 'month-in-9-days', durationDays: 30, expiresAt: new Date(NOW.getTime() + 9 * DAY) },
        { id: 'week-in-1-day', durationDays: 7, expiresAt: new Date(NOW.getTime() + 1 * DAY) },
        { id: 'week-in-3-days', durationDays: 7, expiresAt: new Date(NOW.getTime() + 3 * DAY) },
        { id: 'two-days-long', durationDays: 2, expiresAt: new Date(NOW.getTime() + 1 * DAY) },
      ];
      const prisma = {
        featuredListing: {
          findMany: jest.fn().mockResolvedValue(periods),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const { service, events } = makeService(prisma);

      await service.sendReminders(NOW);

      expect(events.emit.mock.calls.map((call) => call[1].featuredId)).toEqual(['month-in-6-days', 'week-in-1-day']);
      // Marked first, so a second run never sends it again.
      expect(prisma.featuredListing.updateMany).toHaveBeenCalledWith({
        where: { id: 'month-in-6-days', reminderSentAt: null },
        data: { reminderSentAt: NOW },
      });
    });

    it('tells the owner a period ended, unless the listing is gone', async () => {
      const prisma = {
        featuredListing: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ended', listing: { status: 'ACTIVE' } },
            { id: 'deleted-listing', listing: { status: 'DELETED' } },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const { service, events } = makeService(prisma);

      await service.noticeEndedPeriods(NOW);

      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith('featured.ended', { featuredId: 'ended' });
      // Only periods that ended in the last two days: a deploy never mails old ones.
      expect(prisma.featuredListing.findMany.mock.calls[0][0].where.expiresAt).toEqual({
        lte: NOW,
        gt: new Date(NOW.getTime() - 2 * DAY),
      });
    });
  });

  describe("an owner's request", () => {
    function requestPrisma(listing: Record<string, unknown>, rules: Record<string, unknown> = {}) {
      return {
        setting: settings({ featured_rules: { defaultDays: 30, ...rules } }),
        listing: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'l1',
            userId: 'u1',
            categoryId: 'stanovi',
            status: 'ACTIVE',
            user: { blocked: false, restrictedUntil: null },
            ...listing,
          }),
        },
        featuredListing: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
        featuredRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data })),
        },
      };
    }

    it('waits for an admin, and the admins hear about it', async () => {
      const prisma = requestPrisma({});
      const { service, events } = makeService(prisma);

      await expect(service.requestByOwner('u1', 'l1', NOW)).resolves.toEqual({ id: 'r1', status: 'PENDING' });
      expect(prisma.featuredRequest.create).toHaveBeenCalledWith({
        data: { listingId: 'l1', source: 'REQUEST', status: 'PENDING', durationDays: 30, requestedAt: NOW },
      });
      expect(events.emit).toHaveBeenCalledWith('featured.requested', { requestId: 'r1' });
    });

    it("refuses someone else's listing", async () => {
      const { service } = makeService(requestPrisma({ userId: 'someone-else' }));
      await expect(service.requestByOwner('u1', 'l1', NOW)).rejects.toThrow(ForbiddenException);
    });

    it('refuses while featuring is switched off', async () => {
      const { service } = makeService(requestPrisma({}, { enabled: false }));
      await expect(service.requestByOwner('u1', 'l1', NOW)).rejects.toThrow('errors.FEATURED_DISABLED');
    });

    it('refuses an owner who already asked for another listing in the category', async () => {
      const prisma = requestPrisma({});
      prisma.featuredRequest.count.mockResolvedValue(1);
      const { service } = makeService(prisma);
      await expect(service.requestByOwner('u1', 'l1', NOW)).rejects.toThrow('errors.FEATURED_OWNER_LIMIT');
    });
  });
});
