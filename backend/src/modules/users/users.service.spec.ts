import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { LISTING_COUNTS_CACHE_KEY } from '../taxonomy/taxonomy.service';

const i18n = { t: jest.fn((key: string) => key) };
const taxonomy = {
  getCategoryNames: jest.fn().mockResolvedValue(new Map([['c1', 'Kuće i vikendice']])),
  getOptionNames: jest.fn().mockResolvedValue(new Map([['o1', 'Bazen']])),
};

function makeService(prisma: any, cache: any = {}) {
  return new UsersService(prisma, {} as any, i18n as any, {} as any, taxonomy as any, cache);
}

// A whole Listing row, private fields included, the way Prisma hands it over.
function listingRow(overrides: Record<string, any> = {}) {
  return {
    id: 'l1',
    userId: 'owner-1',
    slug: 'kuca-zemun',
    title: 'Kuća sa velikom terasom, Zemun',
    description: 'Opis',
    status: 'ACTIVE',
    bookingModel: 'PER_STAY',
    priceUnit: 'NIGHT',
    price: 1_400_000n,
    weekendPrice: 1_600_000n,
    pricePerGuest: null,
    avgRating: '4.7',
    reviewCount: 12,
    address: 'Karađorđev trg 1',
    icalExportToken: 'secret-token',
    googlePlaceId: 'place-1',
    latitude: '44.8430000',
    longitude: '20.4010000',
    category: { id: 'c1', slug: 'kuce-i-vikendice', icon: 'house', cardFactKeys: [], parent: { cardFactKeys: ['kapacitet_ljudi'] } },
    city: { id: 'city-1', name: 'Beograd', slug: 'beograd' },
    cityArea: { id: 'area-1', name: 'Zemun', slug: 'zemun' },
    photos: [{ id: 'p1', url: 'cover.jpg', altText: null, isCover: true }],
    attributes: [
      { attribute: { key: 'kapacitet_ljudi', unit: null, type: 'NUMBER', icon: null }, valueNumber: '8', valueText: null, valueBoolean: null, valueOptionIds: [] },
      { attribute: { key: 'sadrzaji', unit: null, type: 'CHECKBOX_GROUP', icon: 'bazen' }, valueNumber: null, valueText: null, valueBoolean: null, valueOptionIds: ['o1'] },
    ],
    ...overrides,
  };
}

describe('UsersService#listFavorites (Dizajn 36)', () => {
  it('asks only for live listings and the card include', async () => {
    const prisma = { favorite: { findMany: jest.fn().mockResolvedValue([]) } };
    await makeService(prisma).listFavorites('u1');

    const query = prisma.favorite.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: 'u1', listing: { status: 'ACTIVE' } });
    expect(query.orderBy).toEqual({ addedAt: 'desc' });
    expect(query.select.listing.include.photos).toEqual({
      where: { isCover: true, pendingRemoval: false, versionId: null },
      take: 1,
    });
    expect(query.select.listing.include.cityArea).toBe(true);
    expect(query.select).not.toHaveProperty('priceAtAdd');
  });

  it('returns the search card shape and nothing private', async () => {
    const addedAt = new Date('2026-09-10T08:00:00Z');
    const prisma = {
      favorite: { findMany: jest.fn().mockResolvedValue([{ listingId: 'l1', addedAt, listing: listingRow() }]) },
    };
    const [favorite] = await makeService(prisma).listFavorites('u1');

    expect(favorite).toEqual({
      listingId: 'l1',
      addedAt,
      listing: {
        id: 'l1',
        slug: 'kuca-zemun',
        title: 'Kuća sa velikom terasom, Zemun',
        price: 14000,
        priceUnit: 'NIGHT',
        avgRating: '4.7',
        reviewCount: 12,
        bookingModel: 'PER_STAY',
        city: { id: 'city-1', name: 'Beograd', slug: 'beograd' },
        cityArea: { id: 'area-1', name: 'Zemun', slug: 'zemun' },
        // T129: the parent's key facts for a category without its own.
        category: { id: 'c1', slug: 'kuce-i-vikendice', icon: 'house', name: 'Kuće i vikendice', cardFactKeys: ['kapacitet_ljudi'] },
        coverPhoto: { id: 'p1', url: 'cover.jpg', altText: null, isCover: true },
        latitude: '44.8430000',
        longitude: '20.4010000',
        attributes: [
          { key: 'kapacitet_ljudi', type: 'NUMBER', unit: null, icon: null, valueNumber: 8, valueText: null, valueBoolean: null, optionNames: [] },
          { key: 'sadrzaji', type: 'CHECKBOX_GROUP', unit: null, icon: 'bazen', valueNumber: null, valueText: null, valueBoolean: null, optionNames: ['Bazen'] },
        ],
      },
    });
    const json = JSON.stringify(favorite);
    for (const secret of ['Karađorđev', 'secret-token', 'place-1', 'owner-1', 'Opis']) expect(json).not.toContain(secret);
  });

  it('shows a listing without a cover or area as the card expects it', async () => {
    const prisma = {
      favorite: {
        findMany: jest.fn().mockResolvedValue([
          { listingId: 'l2', addedAt: new Date(), listing: listingRow({ id: 'l2', photos: [], cityArea: null, attributes: [] }) },
        ]),
      },
    };
    const [favorite] = await makeService(prisma).listFavorites('u1');
    expect(favorite.listing.coverPhoto).toBeNull();
    expect(favorite.listing.cityArea).toBeNull();
    expect(favorite.listing.attributes).toEqual([]);
  });
});

describe('UsersService#addFavorite (Dizajn 36)', () => {
  it('refuses a listing that is not live', async () => {
    const prisma = {
      listing: { findFirst: jest.fn().mockResolvedValue(null) },
      favorite: { upsert: jest.fn() },
    };
    await expect(makeService(prisma).addFavorite('u1', 'l1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listing.findFirst).toHaveBeenCalledWith({ where: { id: 'l1', status: 'ACTIVE' }, select: { price: true } });
    expect(prisma.favorite.upsert).not.toHaveBeenCalled();
  });

  it('saves a live listing with its price at the time', async () => {
    const prisma = {
      listing: { findFirst: jest.fn().mockResolvedValue({ price: 350_000n }) },
      favorite: {
        upsert: jest.fn().mockResolvedValue({ userId: 'u1', listingId: 'l1', priceAtAdd: 350_000n, addedAt: new Date() }),
      },
    };
    const favorite = await makeService(prisma).addFavorite('u1', 'l1');
    expect(prisma.favorite.upsert).toHaveBeenCalledWith({
      where: { userId_listingId: { userId: 'u1', listingId: 'l1' } },
      update: {},
      create: { userId: 'u1', listingId: 'l1', priceAtAdd: 350_000n },
    });
    expect(favorite.priceAtAdd).toBe(3500);
  });
});

describe('UsersService#executeDeletion', () => {
  it('drops the cached category counts once the deleted listings are committed', async () => {
    const steps: string[] = [];
    const tx = {
      booking: { update: jest.fn() },
      listing: { updateMany: jest.fn(async () => steps.push('listings deleted')) },
      subscription: { updateMany: jest.fn() },
      session: { updateMany: jest.fn() },
      user: { update: jest.fn() },
    };
    const prisma = {
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (run: (client: typeof tx) => Promise<void>) => {
        await run(tx);
        steps.push('committed');
      }),
    };
    const cache = { del: jest.fn(async () => steps.push('counts dropped')) };

    await makeService(prisma, cache).executeDeletion('u1');
    expect(cache.del).toHaveBeenCalledWith(LISTING_COUNTS_CACHE_KEY);
    expect(steps).toEqual(['listings deleted', 'committed', 'counts dropped']);
  });

  it('frees the terms of the bookings it cancels', async () => {
    const tx = {
      booking: { update: jest.fn() },
      blockedTerm: { deleteMany: jest.fn() },
      listing: { updateMany: jest.fn() },
      subscription: { updateMany: jest.fn() },
      session: { updateMany: jest.fn() },
      user: { update: jest.fn() },
    };
    const prisma = {
      booking: { findMany: jest.fn().mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]) },
      $transaction: jest.fn(async (run: (client: typeof tx) => Promise<void>) => run(tx)),
    };
    const service = new UsersService(prisma as any, {} as any, i18n as any, { emit: jest.fn() } as any, taxonomy as any, { del: jest.fn() } as any);

    await service.executeDeletion('u1');
    expect(tx.blockedTerm.deleteMany.mock.calls).toEqual([[{ where: { bookingId: 'b1' } }], [{ where: { bookingId: 'b2' } }]]);
  });
});
