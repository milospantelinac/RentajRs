import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import { SearchListingsDto } from './dto/search-listings.dto';

const RELEVANCE_CANDIDATE_POOL = 200;
const DEFAULT_PAGE_SIZE = 20;
const RANKING_WEIGHTS_CACHE_KEY = 'settings:ranking_weights';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private taxonomy: TaxonomyService,
  ) {}

  /** R47 — only attributes flagged as filters, for the given category (used to render the left panel). */
  async getFilterableAttributes(categorySlug: string) {
    const category = await this.prisma.category.findUniqueOrThrow({ where: { slug: categorySlug } });
    const attributes = await this.taxonomy.resolveAttributesForCategory(category.id);
    return attributes.filter((a) => a.isFilter);
  }

  async search(dto: SearchListingsDto) {
    const page = dto.page ?? 1;
    const pageSize = Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, 50);
    const where = await this.buildWhere(dto);

    const result =
      dto.sort && dto.sort !== 'relevance'
        ? await this.searchWithDbSort(where, dto.sort, page, pageSize)
        : await this.searchWithRelevanceRanking(where, page, pageSize);

    // R45/R46 — every empty result is demand data, not just the ones where the
    // visitor bothers to leave an email via /search/notify-empty afterwards.
    if (result.total === 0) {
      await this.recordEmptySearch(dto).catch(() => undefined);
    }

    return { ...result, indexThreshold: await this.getIndexThreshold() };
  }

  private async searchWithDbSort(
    where: Prisma.ListingWhereInput,
    sort: 'price_asc' | 'price_desc' | 'newest',
    page: number,
    pageSize: number,
  ) {
    const orderBy: Prisma.ListingOrderByWithRelationInput =
      sort === 'price_asc'
        ? { price: 'asc' }
        : sort === 'price_desc'
          ? { price: 'desc' }
          : { publishedAt: 'desc' };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.resultInclude(),
      }),
    ]);

    const results = rows.map((r) => this.serializeResult(r));
    return { results, total, page, pageSize };
  }

  /**
   * R146: relevance mixes rating, freshness, response time and a random
   * factor so results don't calcify. Re-scoring the full table per request
   * doesn't scale, so we pull a bounded, cheaply-indexed candidate pool
   * (newest-first, capped at RELEVANCE_CANDIDATE_POOL) and rank *that* in
   * memory — correct for the MVP's listing volumes, and the pool size is
   * the one knob to revisit if/when it isn't (see DOCUMENTATION.md).
   */
  private async searchWithRelevanceRanking(where: Prisma.ListingWhereInput, page: number, pageSize: number) {
    const total = await this.prisma.listing.count({ where });
    const candidates = await this.prisma.listing.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: RELEVANCE_CANDIDATE_POOL,
      include: this.resultInclude(),
    });

    if (candidates.length === 0) {
      return { results: [], total, page, pageSize };
    }

    const weights = await this.getRankingWeights();
    const now = Date.now();
    const maxAgeMs = 1000 * 60 * 60 * 24 * 90; // 90 days -> freshness floor

    const scored = candidates.map((listing) => {
      const ratingScore = listing.avgRating ? Number(listing.avgRating) / 5 : 0.5;
      const ageMs = now - listing.publishedAt!.getTime();
      const freshnessScore = Math.max(0, 1 - ageMs / maxAgeMs);
      const responseScore = listing.user.avgResponseTimeMinutes
        ? Math.max(0, 1 - listing.user.avgResponseTimeMinutes / (24 * 60))
        : 0.5;
      const randomScore = Math.random();

      const score =
        weights.rating * ratingScore +
        weights.freshness * freshnessScore +
        weights.responseTime * responseScore +
        weights.random * randomScore;

      return { listing, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const pageItems = scored.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    return { results: pageItems.map((s) => this.serializeResult(s.listing)), total, page, pageSize };
  }

  private async getRankingWeights(): Promise<{
    rating: number;
    freshness: number;
    responseTime: number;
    random: number;
  }> {
    return this.cache.getOrSet(RANKING_WEIGHTS_CACHE_KEY, 300, async () => {
      const setting = await this.prisma.setting.findUnique({ where: { key: 'ranking_weights' } });
      return (setting?.value as any) ?? { rating: 0.35, freshness: 0.25, responseTime: 0.2, random: 0.2 };
    });
  }

  /** R45/R46 — logs the query as demand data; the frontend calls this once it sees total===0. */
  async recordEmptySearch(dto: SearchListingsDto, notifyEmail?: string) {
    let categoryId: string | undefined;
    if (dto.categorySlug) {
      const category = await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } });
      categoryId = category?.id;
    }
    await this.prisma.emptySearch.create({
      data: {
        query: dto.q,
        categoryId,
        cityId: dto.cityId,
        filters: dto as unknown as Prisma.InputJsonValue,
        notifyEmail,
      },
    });
    return { message: 'ok' };
  }

  /**
   * R135/R11 (Bible Ch.14.3) — which cities have enough listings in this
   * category (including its subcategories) to have an indexable combo page.
   * Used both to render "browse by city" links on the category page (so the
   * page actually has an internal path to it, not just a URL that exists)
   * and could equally back the sitemap generator.
   */
  async getIndexedCitiesForCategory(categorySlug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) return [];

    const categoryIds = await this.categorySubtreeIds(category.id);
    const threshold = await this.getIndexThreshold();
    const groups = await this.prisma.listing.groupBy({
      by: ['cityId'],
      where: { status: 'ACTIVE', categoryId: { in: categoryIds }, cityId: { not: null } },
      _count: { _all: true },
    });
    const qualifyingCityIds = groups.filter((g) => g._count._all >= threshold).map((g) => g.cityId as string);
    if (!qualifyingCityIds.length) return [];

    return this.prisma.city.findMany({
      where: { id: { in: qualifyingCityIds } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Same query with location/date constraints dropped — offered to the user after an empty result set. */
  async relaxedSearch(dto: SearchListingsDto) {
    const relaxed: SearchListingsDto = { ...dto, cityId: undefined, cityAreaId: undefined, dateFrom: undefined, dateTo: undefined };
    return this.search(relaxed);
  }

  private async buildWhere(dto: SearchListingsDto): Promise<Prisma.ListingWhereInput> {
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      available: true,
    };

    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
        { keywords: { has: dto.q } },
      ];
    }

    if (dto.categorySlug) {
      const category = await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } });
      if (category) {
        // Selecting a category includes every descendant, not just direct
        // children — the tree can be 3 levels deep (R24), so a top-level
        // pick must also reach grandchildren (R49).
        where.categoryId = { in: await this.categorySubtreeIds(category.id) };
      }
    }

    if (dto.regionId) where.regionId = dto.regionId;
    if (dto.cityId) where.cityId = dto.cityId;
    if (dto.cityAreaId) where.cityAreaId = dto.cityAreaId;

    if (dto.priceMin !== undefined || dto.priceMax !== undefined) {
      where.price = {
        ...(dto.priceMin !== undefined ? { gte: rsdToPara(dto.priceMin) } : {}),
        ...(dto.priceMax !== undefined ? { lte: rsdToPara(dto.priceMax) } : {}),
      };
    }

    if (dto.guests) {
      where.AND = [
        ...((where.AND as Prisma.ListingWhereInput[]) ?? []),
        { OR: [{ maxGuests: null }, { maxGuests: { gte: dto.guests } }] },
      ];
    }

    if (dto.onlineBookingOnly) {
      where.bookingModel = { not: 'NO_BOOKING' };
    }

    if (dto.minRating) {
      where.avgRating = { gte: dto.minRating };
    }

    if (dto.mapNorth !== undefined && dto.mapSouth !== undefined && dto.mapEast !== undefined && dto.mapWest !== undefined) {
      where.latitude = { gte: dto.mapSouth, lte: dto.mapNorth };
      where.longitude = { gte: dto.mapWest, lte: dto.mapEast };
    }

    if (dto.attributes?.length) {
      const attributeConditions: Prisma.ListingWhereInput[] = dto.attributes.map((filter) => {
        const attributeMatch: Prisma.ListingAttributeWhereInput = { attributeId: filter.attributeId };
        if (filter.min !== undefined || filter.max !== undefined) {
          attributeMatch.valueNumber = {
            ...(filter.min !== undefined ? { gte: filter.min } : {}),
            ...(filter.max !== undefined ? { lte: filter.max } : {}),
          };
        }
        if (filter.boolean !== undefined) attributeMatch.valueBoolean = filter.boolean;
        if (filter.optionIds?.length) attributeMatch.valueOptionIds = { hasSome: filter.optionIds };
        return { attributes: { some: attributeMatch } };
      });
      where.AND = [...((where.AND as Prisma.ListingWhereInput[]) ?? []), ...attributeConditions];
    }

    // RNT-053 — "does this listing have a free slot covering [dateFrom,
    // dateTo]?" via the Availability module's own BlockedTerm rows (the same
    // source lockTerm()/getAvailability() use): a listing is excluded only
    // when something already overlaps the requested range, regardless of
    // source (booking, manual block, gap, iCal import).
    if (dto.dateFrom && dto.dateTo) {
      where.bookingModel = { not: 'NO_BOOKING' };
      const overlapping = await this.prisma.blockedTerm.findMany({
        where: { startsAt: { lt: new Date(dto.dateTo) }, endsAt: { gt: new Date(dto.dateFrom) } },
        select: { listingId: true },
        distinct: ['listingId'],
      });
      if (overlapping.length) {
        where.id = { notIn: overlapping.map((b) => b.listingId) };
      }
    }

    return where;
  }

  private resultInclude() {
    return {
      // Same last-approved-state guarantee as getPublicBySlug (R32) — a
      // search card must never show a photo the listing's own page would
      // hide because it's pending removal or still awaiting approval.
      photos: { where: { isCover: true, pendingRemoval: false, versionId: null }, take: 1 },
      category: true,
      city: true,
      cityArea: true,
      user: { select: { avgResponseTimeMinutes: true } },
    } satisfies Prisma.ListingInclude;
  }

  /** Feeds the frontend's dynamic sitemap — every publicly reachable, genuinely indexable URL. */
  async getSitemapUrls() {
    const [listings, categories, cityCategoryGroups, threshold] = await Promise.all([
      this.prisma.listing.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true, publishedAt: true },
      }),
      this.prisma.category.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true },
      }),
      this.prisma.listing.groupBy({
        by: ['categoryId', 'cityId'],
        where: { status: 'ACTIVE', cityId: { not: null } },
        _count: { _all: true },
      }),
      this.getIndexThreshold(),
    ]);

    // R135 — only combinations that clear the indexing threshold get a
    // sitemap entry; below that they're visitor-reachable but intentionally
    // absent here (they self-report noindex too).
    const qualifying = cityCategoryGroups.filter((g) => g._count._all >= threshold && g.cityId);
    const categoryIds = [...new Set(qualifying.map((g) => g.categoryId))];
    const cityIds = [...new Set(qualifying.map((g) => g.cityId as string))];
    const [cats, cities] = await Promise.all([
      this.prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, slug: true } }),
      this.prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, slug: true } }),
    ]);
    const categorySlugById = new Map(cats.map((c) => [c.id, c.slug]));
    const citySlugById = new Map(cities.map((c) => [c.id, c.slug]));

    return {
      listings: listings.map((l) => ({ slug: l.slug, updatedAt: l.publishedAt })),
      categories: categories.map((c) => ({ slug: c.slug })),
      categoryCities: qualifying
        .map((g) => ({
          categorySlug: categorySlugById.get(g.categoryId),
          citySlug: citySlugById.get(g.cityId as string),
        }))
        .filter((g): g is { categorySlug: string; citySlug: string } => !!g.categorySlug && !!g.citySlug),
    };
  }

  /** R24 — walks up to 2 levels below the given category; the tree never goes deeper. */
  private async categorySubtreeIds(rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];
    for (let depth = 0; depth < 2 && frontier.length; depth++) {
      const children = await this.prisma.category.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      if (!children.length) break;
      frontier = children.map((c) => c.id);
      ids.push(...frontier);
    }
    return ids;
  }

  /** R171 — admin-editable in /admin/podesavanja (Setting.listing_index_threshold). */
  private async getIndexThreshold(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'listing_index_threshold' } });
    return typeof setting?.value === 'number' ? setting.value : 3;
  }

  private serializeResult(listing: any) {
    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      price: paraToRsd(listing.price),
      priceUnit: listing.priceUnit,
      avgRating: listing.avgRating,
      reviewCount: listing.reviewCount,
      bookingModel: listing.bookingModel,
      city: listing.city,
      cityArea: listing.cityArea,
      category: { id: listing.category.id, slug: listing.category.slug, icon: listing.category.icon },
      coverPhoto: listing.photos[0] ?? null,
      latitude: listing.latitude,
      longitude: listing.longitude,
    };
  }
}
