import { foldPlaceText, placeMatchFields, scorePlace } from '../../common/utils/place-search';
import { LocationsService } from './locations.service';
import { LocationAdminService, placeRedirectPath } from './location-admin.service';

const i18n = { t: (key: string) => key };
const cache = {
  getOrSet: jest.fn((_key: string, _ttl: number, compute: () => unknown) => compute()),
  del: jest.fn(),
  delByPrefix: jest.fn(),
};

const REGIONS = [
  { id: 'r-bg', name: 'Beograd', slug: 'beograd' },
  { id: 'r-srem', name: 'Sremski okrug', slug: 'sremski-okrug' },
  { id: 'r-jab', name: 'Jablanički okrug', slug: 'jablanicki-okrug' },
  { id: 'r-bor', name: 'Borski okrug', slug: 'borski-okrug' },
];
const CITIES = [
  { id: 'c-bg', name: 'Beograd', slug: 'beograd', municipality: 'Beograd', kind: 'SEAT', regionId: 'r-bg', nameLocative: 'Beogradu', hidden: false },
  { id: 'c-surduk', name: 'Surduk', slug: 'surduk', municipality: 'Stara Pazova', kind: 'VILLAGE', regionId: 'r-srem', nameLocative: null, hidden: false },
  { id: 'c-sp', name: 'Stara Pazova', slug: 'stara-pazova', municipality: 'Stara Pazova', kind: 'SEAT', regionId: 'r-srem', nameLocative: null, hidden: false },
  { id: 'c-np', name: 'Nova Pazova', slug: 'nova-pazova', municipality: 'Stara Pazova', kind: 'VILLAGE', regionId: 'r-srem', nameLocative: null, hidden: false },
  { id: 'c-ns-leb', name: 'Novo Selo', slug: 'novo-selo-lebane', municipality: 'Lebane', kind: 'VILLAGE', regionId: 'r-jab', nameLocative: null, hidden: false },
  { id: 'c-ns-les', name: 'Novo Selo', slug: 'novo-selo-leskovac', municipality: 'Leskovac', kind: 'VILLAGE', regionId: 'r-jab', nameLocative: null, hidden: false },
  { id: 'c-bor', name: 'Bor', slug: 'bor', municipality: 'Bor', kind: 'SEAT', regionId: 'r-bor', nameLocative: 'Boru', hidden: false },
  { id: 'c-borca', name: 'Borča', slug: 'borca', municipality: 'Palilula', kind: 'TOWN', regionId: 'r-bg', nameLocative: null, hidden: false },
  { id: 'c-dj', name: 'Đurđevo', slug: 'djurdjevo', municipality: 'Žabalj', kind: 'VILLAGE', regionId: 'r-srem', nameLocative: null, hidden: false },
];

function locationsWith(cities = CITIES, areas = [{ id: 'a-vracar', name: 'Vračar', slug: 'vracar', cityId: 'c-bg' }], counts: Record<string, number> = {}) {
  const prisma = {
    region: { findMany: jest.fn().mockResolvedValue(REGIONS) },
    city: { findMany: jest.fn().mockResolvedValue(cities.filter((city) => !city.hidden)) },
    cityArea: { findMany: jest.fn().mockResolvedValue(areas) },
    listing: {
      groupBy: jest.fn(({ by }) =>
        Promise.resolve(
          by[0] === 'cityId'
            ? Object.entries(counts).map(([cityId, count]) => ({ cityId, _count: { _all: count } }))
            : [],
        ),
      ),
    },
  };
  return { service: new LocationsService(prisma as any, cache as any), prisma };
}

describe('place search (T119)', () => {
  it('reads Latin and Cyrillic alike, without diacritics, with đ and dj as d', () => {
    expect(foldPlaceText('Đurđevo')).toBe('durdevo');
    expect(foldPlaceText('djurdjevo')).toBe('durdevo');
    expect(foldPlaceText('Ђурђево')).toBe('durdevo');
    expect(foldPlaceText('Сурдук')).toBe('surduk');
    expect(foldPlaceText('  Stara   PAZOVA ')).toBe('stara pazova');
    expect(foldPlaceText('Banovci-Dunav')).toBe('banovci dunav');
  });

  it('needs every typed word to start a word of the name or of the municipality', () => {
    const surduk = placeMatchFields('Surduk', ['Stara Pazova']);
    expect(scorePlace('surduk', surduk)).toBe(5);
    expect(scorePlace('sur', surduk)).toBe(4);
    // A whole first word before the start of a longer one: Nova Pazova, then Novaci.
    expect(scorePlace('nova', placeMatchFields('Nova Pazova'))).toBeGreaterThan(scorePlace('nova', placeMatchFields('Novaci')));
    expect(scorePlace('surduk stara', surduk)).toBe(1);
    expect(scorePlace('urduk', surduk)).toBe(-1);
    const stara = placeMatchFields('Stara Pazova', ['Stara Pazova']);
    expect(scorePlace('pazova', stara)).toBe(2);
    // A word shorter than three letters narrows by the name only.
    const novake = placeMatchFields('Novake', ['Prizren']);
    expect(scorePlace('nova p', novake)).toBe(-1);
    expect(scorePlace('nova pri', novake)).toBe(1);
  });

  it('puts the town before the villages that start the same, and finds both places of a shared name', async () => {
    const { service } = locationsWith();
    const bor = await service.search('bor');
    expect(bor.map((place: any) => place.id)).toEqual(['c-bor', 'c-borca']);
    const novo = await service.search('novo selo');
    expect(novo.map((place: any) => [place.id, place.municipality, place.sharedName])).toEqual([
      ['c-ns-leb', 'Lebane', true],
      ['c-ns-les', 'Leskovac', true],
    ]);
    expect((await service.search('novo selo lesk')).map((place: any) => place.id)).toEqual(['c-ns-les']);
  });

  it('finds a part of a city with its city, and can leave the parts out or keep to an okrug', async () => {
    const { service } = locationsWith();
    const vracar = await service.search('vrac');
    expect(vracar).toEqual([
      expect.objectContaining({ type: 'area', id: 'a-vracar', city: expect.objectContaining({ id: 'c-bg', name: 'Beograd' }) }),
    ]);
    expect(await service.search('vrac', { withAreas: false })).toEqual([]);
    // Surduk only by its municipality, so after both Pazovas; the seat first.
    expect((await service.search('pazova', { regionId: 'r-srem' })).map((place: any) => place.id)).toEqual(['c-sp', 'c-np', 'c-surduk']);
    expect(await service.search('pazova', { regionId: 'r-bor' })).toEqual([]);
    // The wizard's okrug comes first among names that match as well.
    expect((await service.search('novo selo', { preferRegionId: 'r-jab' })).map((place: any) => place.id)).toEqual(['c-ns-leb', 'c-ns-les']);
    expect((await service.search('bo', { preferRegionId: 'r-bg' })).map((place: any) => place.id).slice(0, 2)).toEqual(['c-borca', 'c-bor']);
  });

  it('offers the places with the most live listings when nothing is typed', async () => {
    const { service } = locationsWith(CITIES, [], { 'c-surduk': 2, 'c-bg': 7 });
    expect((await service.search('')).map((place: any) => place.id)).toEqual(['c-bg', 'c-surduk']);
  });

  it('builds the list once and again after an admin edit', async () => {
    const { service, prisma } = locationsWith();
    await service.search('bor');
    await service.search('sur');
    expect(prisma.city.findMany).toHaveBeenCalledTimes(1);
    await service.invalidate();
    await service.search('bor');
    expect(prisma.city.findMany).toHaveBeenCalledTimes(2);
    expect(cache.delByPrefix).toHaveBeenCalledWith('taxonomy:city:');
  });
});

describe('Administracija > Lokacije (T119)', () => {
  function adminWith(prisma: any) {
    const taxonomy = { logChange: jest.fn() };
    const locations = { invalidate: jest.fn() };
    return { service: new LocationAdminService(prisma, taxonomy as any, locations as any, i18n as any), taxonomy, locations };
  }

  it('refuses to delete a place with listings and says how many', async () => {
    const prisma = {
      city: { findUnique: jest.fn().mockResolvedValue(CITIES[1]), delete: jest.fn() },
      listing: { count: jest.fn().mockResolvedValue(3) },
    };
    const { service } = adminWith(prisma);
    await expect(service.deleteCity('admin', 'c-surduk')).rejects.toMatchObject({
      response: { code: 'CITY_IN_USE', listingCount: 3 },
    });
    expect(prisma.city.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete an okrug that still has places', async () => {
    const prisma = {
      region: { findUnique: jest.fn().mockResolvedValue(REGIONS[1]), delete: jest.fn() },
      city: { count: jest.fn().mockResolvedValue(109) },
    };
    const { service } = adminWith(prisma);
    await expect(service.deleteRegion('admin', 'r-srem')).rejects.toMatchObject({ response: { code: 'REGION_HAS_CITIES', cityCount: 109 } });
  });

  it('moves the listings with a place to another okrug, and leaves a redirect behind a new slug', async () => {
    const tx = {
      city: { update: jest.fn().mockResolvedValue({ ...CITIES[1], regionId: 'r-bg', slug: 'surduk-novi' }) },
      listing: { updateMany: jest.fn().mockResolvedValue({ count: 4 }) },
      redirect: { deleteMany: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
    };
    const prisma = {
      city: {
        findUnique: jest.fn(({ where }) => Promise.resolve(where.id ? CITIES[1] : null)),
      },
      region: { findUnique: jest.fn().mockResolvedValue(REGIONS[0]) },
      $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
    };
    const { service, taxonomy, locations } = adminWith(prisma);
    const result = await service.updateCity('admin', 'c-surduk', { regionId: 'r-bg', slug: 'surduk-novi' });
    expect(tx.listing.updateMany).toHaveBeenCalledWith({ where: { cityId: 'c-surduk' }, data: { regionId: 'r-bg' } });
    expect(tx.redirect.upsert).toHaveBeenCalledWith({
      where: { oldPath: placeRedirectPath('surduk') },
      update: { newPath: '/grad/surduk-novi', type: 301 },
      create: { oldPath: '/grad/surduk', newPath: '/grad/surduk-novi', type: 301 },
    });
    expect(tx.redirect.updateMany).toHaveBeenCalledWith({ where: { newPath: '/grad/surduk' }, data: { newPath: '/grad/surduk-novi' } });
    expect(result.listingsMoved).toBe(4);
    expect(taxonomy.logChange).toHaveBeenCalledWith(
      'admin',
      'city.update',
      'City',
      'c-surduk',
      CITIES[1],
      expect.objectContaining({ regionId: 'r-bg', listingsMoved: 4 }),
    );
    expect(locations.invalidate).toHaveBeenCalled();
  });

  it('gives a new place with a taken name its municipality in the slug', async () => {
    const taken = new Set(['novo-selo']);
    const prisma = {
      region: { findUnique: jest.fn().mockResolvedValue(REGIONS[2]) },
      city: {
        findUnique: jest.fn(({ where }) => Promise.resolve(taken.has(where.slug) ? { id: 'x' } : null)),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'new', ...data })),
      },
      redirect: { deleteMany: jest.fn() },
    };
    const { service } = adminWith(prisma);
    const city = await service.createCity('admin', { regionId: 'r-jab', name: 'Novo Selo', municipality: 'Bojnik' });
    expect(city.slug).toBe('novo-selo-bojnik');
    expect(city.kind).toBe('VILLAGE');
    // An old slug of a renamed place stops redirecting once a new place takes it.
    expect(prisma.redirect.deleteMany).toHaveBeenCalledWith({ where: { oldPath: '/grad/novo-selo-bojnik' } });
  });

  it('pages and searches the places, with their listings', async () => {
    const prisma = {
      city: { findMany: jest.fn().mockResolvedValue(CITIES) },
      region: { findMany: jest.fn().mockResolvedValue(REGIONS) },
      listing: {
        groupBy: jest.fn(({ where }) =>
          Promise.resolve(where.status === 'ACTIVE' ? [{ cityId: 'c-surduk', _count: { _all: 1 } }] : [{ cityId: 'c-surduk', _count: { _all: 2 } }]),
        ),
      },
      cityArea: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const { service } = adminWith(prisma);
    const found = await service.cities({ q: 'pazova' });
    expect(found.items.map((city: any) => city.id)).toEqual(['c-np', 'c-sp', 'c-surduk']);
    const used = await service.cities({ withListings: '1' });
    expect(used.items).toEqual([expect.objectContaining({ id: 'c-surduk', listingCount: 2, activeListingCount: 1, region: { id: 'r-srem', name: 'Sremski okrug' } })]);
    const second = await service.cities({ page: 2, pageSize: 4 });
    expect(second.total).toBe(CITIES.length);
    expect(second.items).toHaveLength(4);
  });
});
