import { Injectable, NotFoundException } from '@nestjs/common';
import { PlaceKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import {
  PLACE_KIND_ORDER,
  PlaceMatchFields,
  placeMatchFields,
  placeNameCollator,
  scorePlace,
} from '../../common/utils/place-search';

const CACHE_TTL = 60 * 30;
/** One place by id or slug: a landing page, a search page opened from a link. */
const CITY_CACHE_PREFIX = 'taxonomy:city:';
const CITIES_CACHE_PREFIX = 'taxonomy:cities:';
const AREAS_CACHE_PREFIX = 'taxonomy:areas:';
const REGIONS_CACHE_KEY = 'taxonomy:regions';
/** How long the search keeps its list of places before it reads them again (an admin edit clears it at once). */
const INDEX_TTL_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PLACE_SEARCH_MAX = 20;
const PLACE_SEARCH_DEFAULT = 8;

type RegionRef = { id: string; name: string };

interface PlaceEntry extends PlaceMatchFields {
  type: 'city' | 'area';
  id: string;
  name: string;
  slug: string;
  regionId: string;
  kindOrder: number;
  activeListings: number;
  result: Record<string, unknown>;
}

/**
 * T119: the places a listing can be in, for the visitors: the okrugs, the
 * settlements and the parts of a city, and the search the place fields use
 * (homepage, search page, wizard). Hidden places and parts are left out of
 * every list and of the search, but a page that asks for one by its id or
 * slug still gets it, since listings may still be in it.
 */
@Injectable()
export class LocationsService {
  private index: { at: number; entries: PlaceEntry[] } | null = null;
  private building: Promise<PlaceEntry[]> | null = null;

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getRegions() {
    return this.cache.getOrSet(REGIONS_CACHE_KEY, CACHE_TTL, async () => {
      const regions = await this.prisma.region.findMany();
      return regions.sort(byRegionName);
    });
  }

  async getCities(regionId?: string) {
    return this.cache.getOrSet(`${CITIES_CACHE_PREFIX}${regionId ?? 'all'}`, CACHE_TTL, async () => {
      const cities = await this.prisma.city.findMany({ where: { hidden: false, ...(regionId ? { regionId } : {}) } });
      return cities.sort((a, b) => placeNameCollator.compare(a.name, b.name));
    });
  }

  /** A place by its id or its slug, with its okrug. */
  async getCity(key: string) {
    return this.cache.getOrSet(`${CITY_CACHE_PREFIX}${key}`, CACHE_TTL, async () => {
      const city = await this.prisma.city.findUnique({
        where: UUID.test(key) ? { id: key } : { slug: key },
        include: { region: { select: { id: true, name: true, slug: true } } },
      });
      if (!city) throw new NotFoundException();
      return city;
    });
  }

  async getCityAreas(citySlug: string) {
    return this.cache.getOrSet(`${AREAS_CACHE_PREFIX}${citySlug}`, CACHE_TTL, async () => {
      const city = await this.prisma.city.findUnique({ where: { slug: citySlug } });
      if (!city) throw new NotFoundException();
      const areas = await this.prisma.cityArea.findMany({ where: { cityId: city.id, hidden: false } });
      return areas.sort((a, b) => placeNameCollator.compare(a.name, b.name));
    });
  }

  /**
   * The places that match what was typed, best first: the name before the
   * municipality, the okrug the wizard has picked (preferRegionId) before the
   * others, a seat before a town before a village, then the places with more
   * listings. Parts of a city come too ("Vračar, Beograd") unless withAreas
   * is false; regionId keeps to one okrug. With nothing typed, the places with
   * the most listings.
   */
  async search(
    typed: string,
    options: { regionId?: string; preferRegionId?: string; limit?: number; withAreas?: boolean } = {},
  ) {
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? PLACE_SEARCH_DEFAULT), 1), PLACE_SEARCH_MAX);
    const entries = (await this.getIndex()).filter(
      (entry) =>
        (options.withAreas !== false || entry.type === 'city') && (!options.regionId || entry.regionId === options.regionId),
    );
    if (!String(typed ?? '').trim()) {
      return entries
        .filter((entry) => entry.type === 'city' && entry.activeListings > 0)
        .sort((a, b) => b.activeListings - a.activeListings || b.kindOrder - a.kindOrder || placeNameCollator.compare(a.name, b.name))
        .slice(0, limit)
        .map((entry) => entry.result);
    }
    const scored: Array<{ entry: PlaceEntry; score: number }> = [];
    for (const entry of entries) {
      const score = scorePlace(typed, entry);
      if (score > 0) scored.push({ entry, score });
    }
    const preferred = (entry: PlaceEntry) => (options.preferRegionId && entry.regionId === options.preferRegionId ? 1 : 0);
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        preferred(b.entry) - preferred(a.entry) ||
        b.entry.kindOrder - a.entry.kindOrder ||
        b.entry.activeListings - a.entry.activeListings ||
        (a.entry.type === b.entry.type ? 0 : a.entry.type === 'city' ? -1 : 1) ||
        a.entry.name.length - b.entry.name.length ||
        placeNameCollator.compare(a.entry.name, b.entry.name),
    );
    return scored.slice(0, limit).map(({ entry }) => entry.result);
  }

  /** After an admin edit: every list and the search read the places again. */
  async invalidate() {
    this.index = null;
    await this.cache.del(REGIONS_CACHE_KEY);
    await this.cache.delByPrefix(CITIES_CACHE_PREFIX);
    await this.cache.delByPrefix(CITY_CACHE_PREFIX);
    await this.cache.delByPrefix(AREAS_CACHE_PREFIX);
  }

  // Kept in the process rather than Redis: the search walks every place on
  // every keystroke, and parsing some 6,300 rows out of Redis each time would
  // cost more than the walk itself.
  private async getIndex(): Promise<PlaceEntry[]> {
    if (this.index && Date.now() - this.index.at < INDEX_TTL_MS) return this.index.entries;
    if (!this.building) {
      this.building = this.buildIndex()
        .then((entries) => {
          this.index = { at: Date.now(), entries };
          return entries;
        })
        .finally(() => {
          this.building = null;
        });
    }
    return this.building;
  }

  private async buildIndex(): Promise<PlaceEntry[]> {
    const [regions, cities, areas, cityCounts, areaCounts] = await Promise.all([
      this.prisma.region.findMany({ select: { id: true, name: true } }),
      this.prisma.city.findMany({
        where: { hidden: false },
        select: { id: true, name: true, slug: true, municipality: true, kind: true, regionId: true, nameLocative: true },
      }),
      this.prisma.cityArea.findMany({
        where: { hidden: false, city: { hidden: false } },
        select: { id: true, name: true, slug: true, cityId: true },
      }),
      this.prisma.listing.groupBy({ by: ['cityId'], where: { status: 'ACTIVE', cityId: { not: null } }, _count: { _all: true } }),
      this.prisma.listing.groupBy({
        by: ['cityAreaId'],
        where: { status: 'ACTIVE', cityAreaId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const regionById = new Map<string, RegionRef>(regions.map((region) => [region.id, region]));
    const listingsOfCity = new Map(cityCounts.map((row) => [row.cityId, row._count._all]));
    const listingsOfArea = new Map(areaCounts.map((row) => [row.cityAreaId, row._count._all]));
    // A name several places share is shown with the municipality.
    const nameCount = new Map<string, number>();
    for (const city of cities) {
      const key = city.name.toLowerCase();
      nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
    }
    const cityById = new Map(cities.map((city) => [city.id, city]));

    const entries: PlaceEntry[] = cities.map((city) => {
      const region = regionById.get(city.regionId) ?? null;
      return {
        type: 'city',
        id: city.id,
        name: city.name,
        slug: city.slug,
        regionId: city.regionId,
        kindOrder: PLACE_KIND_ORDER[city.kind as PlaceKind],
        activeListings: listingsOfCity.get(city.id) ?? 0,
        ...placeMatchFields(city.name, [city.municipality]),
        result: {
          type: 'city',
          id: city.id,
          name: city.name,
          slug: city.slug,
          municipality: city.municipality,
          kind: city.kind,
          nameLocative: city.nameLocative,
          sharedName: (nameCount.get(city.name.toLowerCase()) ?? 0) > 1,
          region,
        },
      };
    });
    for (const area of areas) {
      const city = cityById.get(area.cityId);
      if (!city) continue;
      const region = regionById.get(city.regionId) ?? null;
      entries.push({
        type: 'area',
        id: area.id,
        name: area.name,
        slug: area.slug,
        regionId: city.regionId,
        // A part of a city reads like a town of its own ("Vračar").
        kindOrder: PLACE_KIND_ORDER.TOWN,
        activeListings: listingsOfArea.get(area.id) ?? 0,
        ...placeMatchFields(area.name, [city.name]),
        result: {
          type: 'area',
          id: area.id,
          name: area.name,
          slug: area.slug,
          city: { id: city.id, name: city.name, slug: city.slug, nameLocative: city.nameLocative },
          region,
        },
      });
    }
    return entries;
  }
}

// Beograd first, then the okrugs by name.
function byRegionName(a: { name: string; slug: string }, b: { name: string; slug: string }) {
  if (a.slug === 'beograd' || b.slug === 'beograd') return a.slug === 'beograd' ? (b.slug === 'beograd' ? 0 : -1) : 1;
  return placeNameCollator.compare(a.name, b.name);
}
