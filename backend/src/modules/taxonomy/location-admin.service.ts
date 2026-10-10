import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { placeMatchFields, placeNameCollator, scorePlace } from '../../common/utils/place-search';
import { TaxonomyService, slugify } from './taxonomy.service';
import { LocationsService } from './locations.service';
import {
  AdminCitiesQueryDto,
  CreateAreaDto,
  CreateCityDto,
  CreateRegionDto,
  UpdateAreaDto,
  UpdateCityDto,
  UpdateRegionDto,
} from './dto/location-admin.dto';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IN_USE: Prisma.ListingWhereInput = { status: { not: 'DELETED' } };
/** A place's landing pages sit at /<category>/<slug>; a new slug leaves this behind for the old one. */
export const placeRedirectPath = (slug: string) => `/grad/${slug}`;

/**
 * T119: Administracija > Lokacije. The okrugs, their places and the parts of
 * a city, under the rules of the rest of the panel (T129): a search and live
 * listing counts, "Sakrij" offered where a delete would leave listings
 * without a place, every change in the history, and a moved URL that keeps
 * leading somewhere. Moving a place to another okrug moves its listings
 * along, since a listing's okrug is its place's.
 */
@Injectable()
export class LocationAdminService {
  constructor(
    private prisma: PrismaService,
    private taxonomy: TaxonomyService,
    private locations: LocationsService,
    private i18n: I18nService,
  ) {}

  // -- Okrugs -----------------------------------------------------------------

  async regions() {
    const [regions, cities, listings] = await Promise.all([
      this.prisma.region.findMany(),
      this.prisma.city.groupBy({ by: ['regionId'], _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['regionId'], where: IN_USE, _count: { _all: true } }),
    ]);
    const cityCount = new Map(cities.map((row) => [row.regionId, row._count._all]));
    const listingCount = new Map(listings.map((row) => [row.regionId, row._count._all]));
    return regions
      .map((region) => ({
        ...region,
        cityCount: cityCount.get(region.id) ?? 0,
        listingCount: listingCount.get(region.id) ?? 0,
      }))
      .sort((a, b) => placeNameCollator.compare(a.name, b.name));
  }

  async createRegion(adminId: string, dto: CreateRegionDto) {
    const name = dto.name.trim();
    const slug = dto.slug?.trim() ? await this.assertRegionSlugFree(dto.slug) : await this.uniqueRegionSlug(name);
    const region = await this.prisma.region.create({ data: { name, slug } });
    await this.taxonomy.logChange(adminId, 'region.create', 'Region', region.id, undefined, region);
    await this.locations.invalidate();
    return region;
  }

  async updateRegion(adminId: string, id: string, dto: UpdateRegionDto) {
    const before = await this.getRegion(id);
    const slug = dto.slug !== undefined && dto.slug.trim() !== before.slug ? await this.assertRegionSlugFree(dto.slug, id) : undefined;
    const region = await this.prisma.region.update({
      where: { id },
      data: { name: dto.name?.trim(), slug },
    });
    if (JSON.stringify(region) !== JSON.stringify(before)) {
      await this.taxonomy.logChange(adminId, 'region.update', 'Region', id, before, region);
    }
    await this.locations.invalidate();
    return region;
  }

  async deleteRegion(adminId: string, id: string) {
    const region = await this.getRegion(id);
    const cityCount = await this.prisma.city.count({ where: { regionId: id } });
    if (cityCount) throw this.refusal('REGION_HAS_CITIES', { cityCount });
    // A draft that picked only the okrug picks again.
    await this.prisma.$transaction([
      this.prisma.listing.updateMany({ where: { regionId: id }, data: { regionId: null } }),
      this.prisma.region.delete({ where: { id } }),
    ]);
    await this.taxonomy.logChange(adminId, 'region.delete', 'Region', id, region, undefined);
    await this.locations.invalidate();
    return { deleted: true };
  }

  // -- Places -------------------------------------------------------------------

  /** The places, searched like the site's place fields and paged (some six thousand rows). */
  async cities(query: AdminCitiesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const [cities, regions, listings, active, areas] = await Promise.all([
      this.prisma.city.findMany({
        where: {
          ...(query.regionId ? { regionId: query.regionId } : {}),
          ...(query.visibility === 'hidden' ? { hidden: true } : query.visibility === 'visible' ? { hidden: false } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          municipality: true,
          kind: true,
          hidden: true,
          nameLocative: true,
          regionId: true,
        },
      }),
      this.prisma.region.findMany({ select: { id: true, name: true } }),
      this.prisma.listing.groupBy({ by: ['cityId'], where: { ...IN_USE, cityId: { not: null } }, _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['cityId'], where: { status: 'ACTIVE', cityId: { not: null } }, _count: { _all: true } }),
      this.prisma.cityArea.groupBy({ by: ['cityId'], _count: { _all: true } }),
    ]);
    const listingCount = new Map(listings.map((row) => [row.cityId, row._count._all]));
    const activeCount = new Map(active.map((row) => [row.cityId, row._count._all]));
    const areaCount = new Map(areas.map((row) => [row.cityId, row._count._all]));
    const regionName = new Map(regions.map((region) => [region.id, region.name]));

    let rows = cities;
    if (query.withListings === '1') rows = rows.filter((city) => listingCount.has(city.id));
    const typed = query.q?.trim();
    if (typed) {
      const scored = rows
        .map((city) => {
          const fields = placeMatchFields(city.name, [city.municipality, city.slug.replace(/-/g, ' ')]);
          return { city, score: scorePlace(typed, fields) };
        })
        .filter((row) => row.score > 0);
      scored.sort((a, b) => b.score - a.score || placeNameCollator.compare(a.city.name, b.city.name));
      rows = scored.map((row) => row.city);
    } else {
      rows = [...rows].sort((a, b) => placeNameCollator.compare(a.name, b.name));
    }
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map((city) => ({
      ...city,
      region: { id: city.regionId, name: regionName.get(city.regionId) ?? '' },
      listingCount: listingCount.get(city.id) ?? 0,
      activeListingCount: activeCount.get(city.id) ?? 0,
      areaCount: areaCount.get(city.id) ?? 0,
    }));
    return { items, total: rows.length, page, pageSize };
  }

  /** One place with its parts and the listings on each. */
  async city(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: { region: { select: { id: true, name: true } }, areas: true },
    });
    if (!city) throw new NotFoundException();
    const [listingCount, activeListingCount, perArea] = await Promise.all([
      this.prisma.listing.count({ where: { ...IN_USE, cityId: id } }),
      this.prisma.listing.count({ where: { status: 'ACTIVE', cityId: id } }),
      this.prisma.listing.groupBy({
        by: ['cityAreaId'],
        where: { ...IN_USE, cityId: id, cityAreaId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const areaListings = new Map(perArea.map((row) => [row.cityAreaId, row._count._all]));
    return {
      ...city,
      areas: city.areas
        .map((area) => ({ ...area, listingCount: areaListings.get(area.id) ?? 0 }))
        .sort((a, b) => placeNameCollator.compare(a.name, b.name)),
      listingCount,
      activeListingCount,
    };
  }

  async createCity(adminId: string, dto: CreateCityDto) {
    await this.getRegion(dto.regionId);
    const name = dto.name.trim();
    const municipality = dto.municipality?.trim() || null;
    const slug = dto.slug?.trim() ? await this.assertCitySlugFree(dto.slug) : await this.uniqueCitySlug(name, municipality);
    const city = await this.prisma.city.create({
      data: {
        regionId: dto.regionId,
        name,
        slug,
        municipality,
        kind: dto.kind ?? 'VILLAGE',
        nameLocative: dto.nameLocative?.trim() || null,
      },
    });
    // A slug a renamed place left behind now belongs to this one.
    await this.prisma.redirect.deleteMany({ where: { oldPath: placeRedirectPath(slug) } });
    await this.taxonomy.logChange(adminId, 'city.create', 'City', city.id, undefined, city);
    await this.locations.invalidate();
    return city;
  }

  async updateCity(adminId: string, id: string, dto: UpdateCityDto) {
    const before = await this.prisma.city.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    if (dto.regionId && dto.regionId !== before.regionId) await this.getRegion(dto.regionId);
    const slug =
      dto.slug !== undefined && dto.slug.trim() !== before.slug ? await this.assertCitySlugFree(dto.slug, id) : undefined;
    const moving = !!dto.regionId && dto.regionId !== before.regionId;

    let listingsMoved = 0;
    const city = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.city.update({
        where: { id },
        data: {
          regionId: dto.regionId,
          name: dto.name?.trim(),
          slug,
          municipality: dto.municipality === undefined ? undefined : dto.municipality.trim() || null,
          kind: dto.kind,
          nameLocative: dto.nameLocative === undefined ? undefined : dto.nameLocative.trim() || null,
          hidden: dto.hidden,
        },
      });
      // A listing's okrug is its place's.
      if (moving) {
        listingsMoved = (await tx.listing.updateMany({ where: { cityId: id }, data: { regionId: dto.regionId } })).count;
      }
      // The old URL of every city page, and every redirect that led to it,
      // now lead to the new one; the new one stops redirecting.
      if (slug) {
        const oldPath = placeRedirectPath(before.slug);
        const newPath = placeRedirectPath(slug);
        await tx.redirect.deleteMany({ where: { oldPath: newPath } });
        await tx.redirect.updateMany({ where: { newPath: oldPath }, data: { newPath } });
        await tx.redirect.upsert({
          where: { oldPath },
          update: { newPath, type: 301 },
          create: { oldPath, newPath, type: 301 },
        });
      }
      return updated;
    });
    if (JSON.stringify(city) !== JSON.stringify(before)) {
      await this.taxonomy.logChange(adminId, 'city.update', 'City', id, before, moving ? { ...city, listingsMoved } : city);
    }
    await this.locations.invalidate();
    return { ...city, listingsMoved };
  }

  async deleteCity(adminId: string, id: string) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException();
    const listingCount = await this.prisma.listing.count({ where: { ...IN_USE, cityId: id } });
    if (listingCount) throw this.refusal('CITY_IN_USE', { listingCount });
    // Its parts go with it (cascade); a deleted listing or a saved empty search loses the place.
    await this.prisma.city.delete({ where: { id } });
    await this.taxonomy.logChange(adminId, 'city.delete', 'City', id, city, undefined);
    await this.locations.invalidate();
    return { deleted: true };
  }

  // -- Parts of a city -----------------------------------------------------------

  async createArea(adminId: string, cityId: string, dto: CreateAreaDto) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException();
    const name = dto.name.trim();
    const slug = dto.slug?.trim() ? await this.assertAreaSlugFree(cityId, dto.slug) : await this.uniqueAreaSlug(cityId, name);
    const area = await this.prisma.cityArea.create({ data: { cityId, name, slug } });
    await this.taxonomy.logChange(adminId, 'area.create', 'CityArea', area.id, undefined, area);
    await this.locations.invalidate();
    return area;
  }

  async updateArea(adminId: string, id: string, dto: UpdateAreaDto) {
    const before = await this.prisma.cityArea.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const slug =
      dto.slug !== undefined && dto.slug.trim() !== before.slug ? await this.assertAreaSlugFree(before.cityId, dto.slug, id) : undefined;
    const area = await this.prisma.cityArea.update({
      where: { id },
      data: { name: dto.name?.trim(), slug, hidden: dto.hidden },
    });
    if (JSON.stringify(area) !== JSON.stringify(before)) {
      await this.taxonomy.logChange(adminId, 'area.update', 'CityArea', id, before, area);
    }
    await this.locations.invalidate();
    return area;
  }

  async deleteArea(adminId: string, id: string) {
    const area = await this.prisma.cityArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException();
    const listingCount = await this.prisma.listing.count({ where: { ...IN_USE, cityAreaId: id } });
    if (listingCount) throw this.refusal('AREA_IN_USE', { listingCount });
    await this.prisma.cityArea.delete({ where: { id } });
    await this.taxonomy.logChange(adminId, 'area.delete', 'CityArea', id, area, undefined);
    await this.locations.invalidate();
    return { deleted: true };
  }

  // -- History ---------------------------------------------------------------------

  /** Every change to the okrugs, places and parts, or one place's own and its parts'. */
  async history(cityId?: string) {
    const where: Prisma.AdminLogWhereInput = cityId
      ? {
          OR: [
            { entityType: 'City', entityId: cityId },
            {
              entityType: 'CityArea',
              OR: [{ newValue: { path: ['cityId'], equals: cityId } }, { oldValue: { path: ['cityId'], equals: cityId } }],
            },
          ],
        }
      : { entityType: { in: ['Region', 'City', 'CityArea'] } };
    return this.prisma.adminLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  // -- Helpers -----------------------------------------------------------------------

  private async getRegion(id: string) {
    const region = await this.prisma.region.findUnique({ where: { id } });
    if (!region) throw new NotFoundException();
    return region;
  }

  private checkSlug(raw: string) {
    const slug = raw.trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) throw this.refusal('LOCATION_SLUG_INVALID');
    return slug;
  }

  private async assertRegionSlugFree(raw: string, ownId?: string) {
    const slug = this.checkSlug(raw);
    const holder = await this.prisma.region.findUnique({ where: { slug }, select: { id: true } });
    if (holder && holder.id !== ownId) throw this.refusal('REGION_SLUG_TAKEN');
    return slug;
  }

  private async assertCitySlugFree(raw: string, ownId?: string) {
    const slug = this.checkSlug(raw);
    const holder = await this.prisma.city.findUnique({ where: { slug }, select: { id: true } });
    if (holder && holder.id !== ownId) throw this.refusal('CITY_SLUG_TAKEN');
    return slug;
  }

  private async assertAreaSlugFree(cityId: string, raw: string, ownId?: string) {
    const slug = this.checkSlug(raw);
    const holder = await this.prisma.cityArea.findUnique({ where: { cityId_slug: { cityId, slug } }, select: { id: true } });
    if (holder && holder.id !== ownId) throw this.refusal('AREA_SLUG_TAKEN');
    return slug;
  }

  private async uniqueRegionSlug(name: string) {
    return this.firstFree(slugify(name) || 'okrug', async (slug) => !!(await this.prisma.region.findUnique({ where: { slug } })));
  }

  // A name another place has gets its municipality, as the imported ones do (novo-selo-lebane).
  private async uniqueCitySlug(name: string, municipality: string | null) {
    const base = slugify(name) || 'mesto';
    const taken = async (slug: string) => !!(await this.prisma.city.findUnique({ where: { slug } }));
    if (!(await taken(base)) || !municipality) return this.firstFree(base, taken);
    return this.firstFree(`${base}-${slugify(municipality)}`, taken);
  }

  private async uniqueAreaSlug(cityId: string, name: string) {
    return this.firstFree(
      slugify(name) || 'deo',
      async (slug) => !!(await this.prisma.cityArea.findUnique({ where: { cityId_slug: { cityId, slug } } })),
    );
  }

  private async firstFree(base: string, taken: (slug: string) => Promise<boolean>) {
    let candidate = base;
    for (let n = 2; await taken(candidate); n++) candidate = `${base}-${n}`;
    return candidate;
  }

  /** A refusal the panel acts on: the message, its code and the count behind it. */
  private refusal(code: string, extra: { listingCount?: number; cityCount?: number } = {}) {
    const count = extra.listingCount ?? extra.cityCount;
    return new BadRequestException({
      message: this.i18n.t(`errors.${code}`, count === undefined ? undefined : { args: { count } }),
      code,
      ...extra,
    });
  }
}
