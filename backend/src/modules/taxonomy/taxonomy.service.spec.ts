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
  const service = new TaxonomyService(prisma, cache as any, { t: (key: string) => key } as any, { emit: jest.fn() } as any, { saveImage: jest.fn() } as any);
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
    const adminLog = { create: jest.fn().mockResolvedValue({}) };
    const { service, cache } = makeService({
      category: {
        findUnique: jest.fn().mockResolvedValue({ ...category('c-ost', 'ostalo'), published: false }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...category('c-ost', 'ostalo'), published: true }),
        update,
      },
      translation: { findMany: jest.fn().mockResolvedValue([{ field: 'name', value: 'Ostalo' }]) },
      adminLog,
      $transaction: jest.fn(async (fn: any) => fn({ category: { update } })),
    });
    await service.adminUpdateCategory('admin-1', 'c-ost', { published: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ published: true }) }));
    expect(cache.del).toHaveBeenCalledWith('taxonomy:tree:v4', LISTING_COUNTS_CACHE_KEY);
    // T129: the change history keeps who changed what, before and after.
    expect(adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'category.update',
        entityType: 'Category',
        entityId: 'c-ost',
        oldValue: expect.objectContaining({ published: false, name: 'Ostalo' }),
        newValue: expect.objectContaining({ published: true, name: 'Ostalo' }),
      }),
    });
  });

  it('gives the admin tree live counts of every listing and of the ones in search (T129)', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([{ categoryId: 'c-stan', _count: { _all: 4 } }])
      .mockResolvedValueOnce([{ categoryId: 'c-stan', _count: { _all: 1 } }]);
    const { service } = makeService({
      category: { findMany: jest.fn().mockResolvedValue([{ ...category('c-stan', 'stanovi'), listingCount: 0 }, category('c-sale', 'sale')]) },
      translation: { findMany: jest.fn().mockResolvedValue([]) },
      listing: { groupBy },
    });
    const rows = await service.adminGetCategoryTree();
    expect(rows.map((row) => [row.slug, row.listingCount, row.activeListingCount])).toEqual([
      ['stanovi', 4, 1],
      ['sale', 0, 0],
    ]);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { not: 'DELETED' } } }));
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
    const { service, cache } = makeService({
      category: { update: jest.fn().mockResolvedValue({ id: 'c1', proposedByUserId: null }) },
      adminLog: { create: jest.fn().mockResolvedValue({}) },
    });
    await service.adminApproveCategory('admin-1', 'c1');
    expect(cache.del).toHaveBeenCalledWith('taxonomy:tree:v4', LISTING_COUNTS_CACHE_KEY);
  });
});

describe('TaxonomyService#getCategoryBySlug', () => {
  it('reads through getOrSet, so it still answers when Redis does not', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ ...category('c-nek', 'nekretnine'), cardFactKeys: [], listingFactKeys: [] }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      translation: { findUnique: jest.fn().mockResolvedValue({ value: 'Nekretnine' }), findMany: jest.fn().mockResolvedValue([]) },
    };
    const { service, cache } = makeService(prisma);
    jest.spyOn(service, 'resolveAttributesForCategory').mockResolvedValue([]);

    await expect(service.getCategoryBySlug('nekretnine')).resolves.toMatchObject({ slug: 'nekretnine', name: 'Nekretnine', children: [] });
    expect(cache.getOrSet).toHaveBeenCalledWith('taxonomy:category:v4:nekretnine', 1800, expect.any(Function));
  });

  it('still answers 404 for an archived category', async () => {
    const prisma = { category: { findUnique: jest.fn().mockResolvedValue({ ...category('c-old', 'oprema'), status: 'ARCHIVED' }) } };
    const { service } = makeService(prisma);
    await expect(service.getCategoryBySlug('oprema')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TaxonomyService admin category rules (T129)', () => {
  const adminLog = () => ({ create: jest.fn().mockResolvedValue({}) });

  it('refuses a delete of a category in use with the code and count the page offers "Sakrij" on', async () => {
    const { service } = makeService({
      category: { findUnique: jest.fn().mockResolvedValue(category('c1', 'sobe')), count: jest.fn().mockResolvedValue(0) },
      listing: { count: jest.fn().mockResolvedValue(3) },
    });
    await expect(service.adminDeleteCategory('admin-1', 'c1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_HAS_LISTINGS', listingCount: 3 }),
    });
  });

  it('takes a new order only when it lists every sibling once', async () => {
    const update = jest.fn().mockResolvedValue({});
    const { service } = makeService({
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a', displayOrder: 0 }, { id: 'b', displayOrder: 1 }]),
        update,
      },
      $transaction: jest.fn(async (ops) => ops),
      adminLog: adminLog(),
    });
    await expect(service.adminReorderCategories('admin-1', { parentId: null, ids: ['a'] })).rejects.toThrow();
    await expect(service.adminReorderCategories('admin-1', { parentId: null, ids: ['a', 'a'] })).rejects.toThrow();
    await service.adminReorderCategories('admin-1', { parentId: null, ids: ['b', 'a'] });
    expect(update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { displayOrder: 0 } });
    expect(update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { displayOrder: 1 } });
  });

  it('refuses to move a category under its own subcategory', async () => {
    const { service } = makeService({
      category: {
        findUnique: jest.fn().mockResolvedValue({ ...category('top', 'nekretnine'), level: 1 }),
        findMany: jest.fn().mockResolvedValueOnce([{ id: 'child' }]).mockResolvedValue([]),
      },
      translation: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await expect(service.adminUpdateCategory('admin-1', 'top', { parentId: 'child' })).rejects.toThrow('errors.CATEGORY_PARENT_INVALID');
  });

  it('moves the URL with a new slug: the old path and the redirects to it lead to the new one', async () => {
    const tx = {
      category: { update: jest.fn(), updateMany: jest.fn() },
      redirect: { deleteMany: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
    };
    const { service } = makeService({
      category: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          where.slug ? null : { ...category('c1', 'sale'), level: 2 },
        ),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...category('c1', 'sale-za-proslave'), level: 2 }),
      },
      translation: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn) => fn(tx)),
      adminLog: adminLog(),
    });
    await service.adminUpdateCategory('admin-1', 'c1', { slug: 'sale-za-proslave' });
    expect(tx.redirect.deleteMany).toHaveBeenCalledWith({ where: { oldPath: '/sale-za-proslave' } });
    expect(tx.redirect.updateMany).toHaveBeenCalledWith({ where: { newPath: '/sale' }, data: { newPath: '/sale-za-proslave' } });
    expect(tx.redirect.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { oldPath: '/sale' } }));
  });

  it('refuses a slug with capitals, diacritics or spaces', async () => {
    const { service } = makeService({
      category: { findUnique: jest.fn().mockResolvedValue({ ...category('c1', 'sale'), level: 2 }) },
      translation: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await expect(service.adminUpdateCategory('admin-1', 'c1', { slug: 'spa centri' })).rejects.toThrow('errors.CATEGORY_SLUG_INVALID');
    await expect(service.adminUpdateCategory('admin-1', 'c1', { slug: 'šank' })).rejects.toThrow('errors.CATEGORY_SLUG_INVALID');
  });
});
