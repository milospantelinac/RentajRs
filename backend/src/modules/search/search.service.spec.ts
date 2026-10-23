import { SearchService } from './search.service';

/** A stand-in listing table: the ranking reads a few columns, the page reads card rows by id. */
function makeSearch(ids: string[], featuredOnTop: string[] = [], featuredAnywhere: string[] = []) {
  const row = (id: string) => ({
    id,
    userId: `owner-${id}`,
    slug: id,
    title: id,
    price: 100_000n,
    priceUnit: 'NIGHT',
    avgRating: null,
    reviewCount: 0,
    bookingModel: 'PER_STAY',
    slotSubmode: null,
    city: null,
    cityArea: null,
    category: { id: 'c', slug: 'c', icon: null, cardFactKeys: [], parent: null },
    photos: [],
    latitude: null,
    longitude: null,
    attributes: [],
  });
  const listing = {
    count: jest.fn(async () => ids.length),
    findMany: jest.fn(async (args: any) => {
      const notIn: string[] = args.where?.AND?.[1]?.id?.notIn ?? [];
      if (args.select) {
        // The ranking pass: every match with what the score reads.
        return ids
          .filter((id) => !notIn.includes(id))
          .map((id) => ({ id, avgRating: null, publishedAt: new Date('2026-10-01'), user: { avgResponseTimeMinutes: null } }));
      }
      if (args.where?.id?.in) return args.where.id.in.map(row).reverse();
      // "Cena" / "Najnovije": the database's own order.
      return ids
        .filter((id) => !notIn.includes(id))
        .slice(args.skip, args.skip + args.take)
        .map(row);
    }),
  };
  const prisma = {
    listing,
    setting: { findUnique: jest.fn(async () => null) },
    emptySearch: { create: jest.fn() },
  };
  const cache = { getOrSet: jest.fn(async (_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()) };
  const taxonomy = { getCategoryNames: jest.fn(async () => new Map()), getOptionNames: jest.fn(async () => new Map()) };
  const featured = {
    pickForSearch: jest.fn(async () => featuredOnTop),
    featuredAmong: jest.fn(async (listingIds: string[]) => new Set(listingIds.filter((id) => featuredAnywhere.includes(id)))),
  };
  const service = new SearchService(prisma as any, cache as any, taxonomy as any, featured as any);
  return { service, prisma, featured };
}

const IDS = Array.from({ length: 30 }, (_, i) => `l${String(i).padStart(2, '0')}`);

describe('SearchService paging and featured listings', () => {
  it('opens the first page with the featured listings and fills it up to the page size', async () => {
    const { service } = makeSearch(IDS, ['l07', 'l21']);
    const first = await service.search({ pageSize: 10 });

    expect(first.results).toHaveLength(10);
    expect(first.results.slice(0, 2).map((r) => r.id)).toEqual(['l07', 'l21']);
    expect(first.results.slice(0, 2).every((r) => r.featured)).toBe(true);
    expect(first.results.slice(2).some((r) => ['l07', 'l21'].includes(r.id))).toBe(false);
    expect(first.featuredIds).toEqual(['l07', 'l21']);
    expect(first.total).toBe(30);
  });

  it('pages through one search without repeats or gaps, featured listings included', async () => {
    const { service } = makeSearch(IDS, ['l07', 'l21']);
    const first = await service.search({ pageSize: 10 });
    const second = await service.search({ pageSize: 10, page: 2, seed: first.seed, featuredIds: first.featuredIds });
    const third = await service.search({ pageSize: 10, page: 3, seed: first.seed, featuredIds: first.featuredIds });

    const seen = [...first.results, ...second.results, ...third.results].map((r) => r.id);
    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);
  });

  it('keeps one order for one seed', async () => {
    const { service } = makeSearch(IDS);
    const a = await service.search({ pageSize: 30, seed: 'same' });
    const b = await service.search({ pageSize: 30, seed: 'same' });
    const c = await service.search({ pageSize: 30, seed: 'other' });

    expect(b.results.map((r) => r.id)).toEqual(a.results.map((r) => r.id));
    expect(c.results.map((r) => r.id)).not.toEqual(a.results.map((r) => r.id));
  });

  it('puts no featured block above a sort the guest chose, but still marks featured cards', async () => {
    const { service, featured } = makeSearch(IDS, ['l07'], ['l03']);
    const page = await service.search({ pageSize: 5, sort: 'price_asc' });

    expect(featured.pickForSearch).not.toHaveBeenCalled();
    expect(page.results.map((r) => r.id)).toEqual(['l00', 'l01', 'l02', 'l03', 'l04']);
    expect(page.results.find((r) => r.id === 'l03')?.featured).toBe(true);
    expect(page.featuredIds).toEqual([]);
  });
});
