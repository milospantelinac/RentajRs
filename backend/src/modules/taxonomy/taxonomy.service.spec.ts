import { NotFoundException } from '@nestjs/common';
import { LISTING_COUNTS_CACHE_KEY, TaxonomyService } from './taxonomy.service';

// Computes every time, the way CacheService answers when Redis is down.
function passThroughCache() {
  return {
    getOrSet: jest.fn((_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()),
    del: jest.fn(async () => undefined),
    delByPrefix: jest.fn(async () => undefined),
  };
}

function makeService(prisma: any) {
  const cache = passThroughCache();
  const service = new TaxonomyService(prisma, cache as any, { t: (key: string) => key } as any, { emit: jest.fn() } as any);
  return { service, cache };
}

const category = (id: string, slug: string, parentId: string | null = null) => ({
  id,
  slug,
  parentId,
  icon: null,
  status: 'ACTIVE',
  displayOrder: 0,
});

describe('TaxonomyService#getCategoryTree', () => {
  const prisma = {
    category: {
      findMany: jest.fn().mockResolvedValue([
        category('c-nek', 'nekretnine'),
        category('c-sale', 'prostori-za-proslave'),
        category('c-stan', 'stanovi', 'c-nek'),
        category('c-kuce', 'kuce-i-vikendice', 'c-nek'),
      ]),
    },
    translation: { findMany: jest.fn().mockResolvedValue([]) },
    listing: {
      groupBy: jest.fn().mockResolvedValue([
        { categoryId: 'c-nek', _count: { _all: 1 } },
        { categoryId: 'c-stan', _count: { _all: 2 } },
        { categoryId: 'c-kuce', _count: { _all: 5 } },
      ]),
    },
  };

  it('counts a parent over its whole subtree, with the listings search finds', async () => {
    const { service } = makeService(prisma);
    const tree = await service.getCategoryTree();

    expect(tree.map((node) => [node.slug, node.listingCount])).toEqual([
      ['nekretnine', 8],
      ['prostori-za-proslave', 0],
    ]);
    expect(tree[0].children.map((node) => [node.slug, node.listingCount])).toEqual([
      ['stanovi', 2],
      ['kuce-i-vikendice', 5],
    ]);
    expect(prisma.listing.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE', available: true } }));
  });

  it('lists only the active categories an admin has published (Dizajn 50)', async () => {
    const { service } = makeService(prisma);
    await service.getCategoryTree();
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', published: true }, orderBy: { displayOrder: 'asc' } }),
    );
  });

  it('drops the tree when an admin publishes or hides a category', async () => {
    const update = jest.fn().mockResolvedValue({});
    const { service, cache } = makeService({
      category: { findUnique: jest.fn().mockResolvedValue(category('c-ost', 'ostalo')), update },
    });
    await service.adminUpdateCategory('c-ost', { published: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ published: true }) }));
    expect(cache.del).toHaveBeenCalledWith('taxonomy:tree:v4', LISTING_COUNTS_CACHE_KEY);
  });

  it('caches the counts for a minute, apart from the tree an admin changes', async () => {
    const { service, cache } = makeService(prisma);
    await service.getCategoryTree();

    const calls = cache.getOrSet.mock.calls.map(([key, ttl]) => [key, ttl]);
    expect(calls).toEqual(expect.arrayContaining([[LISTING_COUNTS_CACHE_KEY, 60], ['taxonomy:tree:v4', 1800]]));
    const structure = await cache.getOrSet.mock.results[calls.findIndex(([key]) => key === 'taxonomy:tree:v4')].value;
    expect(JSON.stringify(structure)).not.toContain('listingCount');
  });

  it('drops the counts along with the tree when an admin changes the categories', async () => {
    const { service, cache } = makeService({ category: { update: jest.fn().mockResolvedValue({ id: 'c1', proposedByUserId: null }) } });
    await service.adminApproveCategory('c1');
    expect(cache.del).toHaveBeenCalledWith('taxonomy:tree:v4', LISTING_COUNTS_CACHE_KEY);
  });
});

describe('TaxonomyService#getCategoryBySlug', () => {
  it('reads through getOrSet, so it still answers when Redis does not', async () => {
    const prisma = {
      category: { findUnique: jest.fn().mockResolvedValue(category('c-nek', 'nekretnine')), findMany: jest.fn().mockResolvedValue([]) },
      translation: { findUnique: jest.fn().mockResolvedValue({ value: 'Nekretnine' }), findMany: jest.fn().mockResolvedValue([]) },
    };
    const { service, cache } = makeService(prisma);
    jest.spyOn(service, 'resolveAttributesForCategory').mockResolvedValue([]);

    await expect(service.getCategoryBySlug('nekretnine')).resolves.toMatchObject({ slug: 'nekretnine', name: 'Nekretnine', children: [] });
    expect(cache.getOrSet).toHaveBeenCalledWith('taxonomy:category:v3:nekretnine', 1800, expect.any(Function));
  });

  it('still answers 404 for an archived category', async () => {
    const prisma = { category: { findUnique: jest.fn().mockResolvedValue({ ...category('c-old', 'oprema'), status: 'ARCHIVED' }) } };
    const { service } = makeService(prisma);
    await expect(service.getCategoryBySlug('oprema')).rejects.toBeInstanceOf(NotFoundException);
  });
});
