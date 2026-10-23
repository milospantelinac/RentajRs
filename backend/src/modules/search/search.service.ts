import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryFilter, FilterControl, FilterPlacement, PriceUnit, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { SEARCH_FILTERS_CACHE_PREFIX, TaxonomyService } from '../taxonomy/taxonomy.service';
import { FeaturedService } from '../featured/featured.service';
import { rsdToPara } from '../../common/utils/money';
import { GUEST_CAPACITY_ATTRIBUTE_KEYS } from '../../common/utils/guest-capacity';
import { LISTING_CARD_INCLUDE, loadListingCardNames, serializeListingCard } from '../../common/utils/listing-card';
import { seededRandom } from '../../common/utils/featured-rules';
import {
  RANKING_WEIGHTS_CACHE_KEY,
  RANKING_WEIGHTS_KEY,
  RankingWeights,
  readRankingWeights,
} from '../../common/utils/ranking-weights';
import {
  SearchFilter,
  SearchFilterChoice,
  SearchFilterOption,
  mergeFilterOptions,
  minFilterChoices,
  optionUnit,
  searchPriceUnits,
} from '../../common/utils/search-filters';
import { SearchListingsDto } from './dto/search-listings.dto';

// "Preporučeno" scores every match from a few columns. Past this many matches
// in one search the oldest are left out; ranking in SQL is the next step then.
const RELEVANCE_MAX_RANKED = 5000;
const DEFAULT_PAGE_SIZE = 20;
const FRESHNESS_FLOOR_MS = 90 * 86_400_000;
// Short: the option counts behind Opremljenost's order move with the listings.
const SEARCH_FILTERS_TTL = 300;

type FilterRow = Pick<CategoryFilter, 'key' | 'attributeKey' | 'optionKey' | 'placement' | 'control' | 'thresholds'>;
type ResolvedAttribute = Awaited<ReturnType<TaxonomyService['resolveAttributesForCategory']>>[number];

// T115: "Svi oglasi" has only the always-there filters and "Deo grada" once a
// city is picked; a category without rows of its own gets the same.
const DEFAULT_FILTER_ROWS: FilterRow[] = [
  { key: 'area', attributeKey: null, optionKey: null, placement: FilterPlacement.BAR, control: FilterControl.AREA, thresholds: [] },
];

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private taxonomy: TaxonomyService,
    private featured: FeaturedService,
  ) {}

  /**
   * T115: what /pretraga offers for a category, 1:1 with Tamara's table: the
   * units of the Cena pill, then the CategoryFilter rows in order (the bar's
   * pills, then the "Više filtera" sections), each with the attributes and
   * options it reads. Price, date and online booking are on every page.
   * "Svi oglasi" (no slug) and a category without rows get the area pill.
   */
  async getSearchFilters(categorySlug?: string) {
    const slug = categorySlug?.trim() || '';
    return this.cache.getOrSet(`${SEARCH_FILTERS_CACHE_PREFIX}${slug || '-'}`, SEARCH_FILTERS_TTL, () =>
      this.loadSearchFilters(slug),
    );
  }

  private async loadSearchFilters(slug: string) {
    if (!slug) return { priceUnits: [] as PriceUnit[], filters: await this.describeFilters(DEFAULT_FILTER_ROWS, []) };

    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { filters: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!category) throw new NotFoundException();
    const children = await this.prisma.category.findMany({
      where: { parentId: category.id, status: 'ACTIVE', published: true },
    });

    // T64: a parent's page ("Sve nekretnine") reads its subcategories'
    // attributes too, since a parent like Nekretnine has none of its own.
    // resolveAttributesForCategory brings the ancestors' along, so Sale za
    // proslave reads the attributes it inherits from Prostori za proslave.
    // T129: a field or item the admin hid is no filter and no choice of one.
    const attributes: ResolvedAttribute[] = [];
    const seen = new Set<string>();
    for (const id of [category.id, ...children.map((child) => child.id)]) {
      for (const attribute of await this.taxonomy.resolveAttributesForCategory(id)) {
        if (seen.has(attribute.id) || attribute.hidden) continue;
        seen.add(attribute.id);
        attributes.push({ ...attribute, options: attribute.options.filter((option) => !option.hidden) });
      }
    }

    const rows = category.filters.length ? category.filters : DEFAULT_FILTER_ROWS;
    return {
      priceUnits: searchPriceUnits(category.defaultPriceUnit, children.length ? children : [category]),
      filters: await this.describeFilters(rows, attributes),
    };
  }

  private async describeFilters(rows: FilterRow[], attributes: ResolvedAttribute[]) {
    // One control can't mix a list with a number (Broj soba is both, T64), so
    // a key reads only the attributes of its first one's type.
    const attributesOf = (key: string | null) => {
      const matches = attributes.filter((attribute) => attribute.key === key);
      return matches.filter((attribute) => attribute.type === matches[0]?.type);
    };
    // Opremljenost leaves out the option a switch of its own already offers.
    const switched = new Set(
      rows.filter((row) => row.control === FilterControl.OPTION_TOGGLE).map((row) => `${row.attributeKey}/${row.optionKey}`),
    );
    const counted = rows
      .filter((row) => row.control === FilterControl.ALL_OF || row.control === FilterControl.MULTI_SELECT)
      .flatMap((row) => attributesOf(row.attributeKey).map((attribute) => attribute.id));
    const counts = await this.countOptionListings(counted);

    const filters: SearchFilter[] = [];
    for (const row of rows) {
      const matched = attributesOf(row.attributeKey);
      const base = {
        key: row.key,
        control: row.control,
        placement: row.placement,
        attributeKey: row.attributeKey,
        name: matched[0]?.name ?? null,
        unit: matched[0]?.unit ?? null,
        attributeIds: matched.map((attribute) => attribute.id),
        options: [] as SearchFilterOption[],
        choices: [] as SearchFilterChoice[],
        optionIds: [] as string[],
      };
      if (row.control === FilterControl.AREA) {
        filters.push(base);
        continue;
      }
      if (row.control === FilterControl.GUESTS) {
        filters.push({ ...base, choices: row.thresholds.map((value) => ({ value, optionIds: [] })) });
        continue;
      }
      // An attribute the category no longer has leaves no empty control behind.
      if (!matched.length) continue;

      const options = mergeFilterOptions(matched, counts);
      if (row.control === FilterControl.OPTION_TOGGLE) {
        const option = options.find((candidate) => candidate.key === row.optionKey);
        if (option) filters.push({ ...base, name: option.name, optionIds: option.ids });
      } else if (row.control === FilterControl.MIN) {
        const choices = minFilterChoices(matched[0].type, options, row.thresholds);
        // A list of preset sizes carries its unit in the names ("20 m²").
        const unit = base.unit ?? (options[0] ? optionUnit(options[0].name) : null);
        if (choices.length) filters.push({ ...base, unit, choices });
      } else if (row.control === FilterControl.RANGE || row.control === FilterControl.TOGGLE) {
        filters.push(base);
      } else {
        const listed = options.filter((option) => !switched.has(`${row.attributeKey}/${option.key}`));
        if (listed.length) filters.push({ ...base, options: listed });
      }
    }
    return filters;
  }

  /** Live listings per option of the given attributes (the "Prikaži još" order in Opremljenost). */
  private async countOptionListings(attributeIds: string[]): Promise<Map<string, number>> {
    if (!attributeIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<Array<{ optionId: string; count: number }>>`
      SELECT o."optionId", COUNT(DISTINCT la."listingId")::int AS "count"
      FROM "ListingAttribute" la
      JOIN "Listing" l ON l."id" = la."listingId"
      CROSS JOIN LATERAL unnest(la."valueOptionIds") AS o("optionId")
      WHERE la."attributeId" = ANY(${attributeIds}::uuid[]) AND l."status" = 'ACTIVE' AND l."available" = true
      GROUP BY o."optionId"`;
    return new Map(rows.map((row) => [row.optionId, row.count]));
  }

  async search(dto: SearchListingsDto) {
    const page = dto.page ?? 1;
    const pageSize = Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, 50);
    const where = await this.buildWhere(dto);
    const relevance = !dto.sort || dto.sort === 'relevance';
    // R146: one seed per search, sent back with "Prikaži još", so all of its
    // pages share one order: no listing twice, none skipped.
    const seed = dto.seed || randomUUID();

    // T129: on "Preporučeno", the featured listings that match this search
    // open its first page (FeaturedService picks which, R114). The next pages
    // get their ids back and leave them out, so none shows twice.
    const featuredIds = relevance
      ? page === 1
        ? await this.featured.pickForSearch(where, pageSize)
        : (dto.featuredIds ?? [])
      : [];
    const rest: Prisma.ListingWhereInput = featuredIds.length ? { AND: [where, { id: { notIn: featuredIds } }] } : where;
    // Every page is pageSize cards: the first holds the featured ones too.
    const skip = Math.max(0, page === 1 ? 0 : (page - 1) * pageSize - featuredIds.length);
    const take = Math.max(0, page === 1 ? pageSize - featuredIds.length : pageSize);

    const [total, restRows, topRows] = await Promise.all([
      this.prisma.listing.count({ where }),
      relevance ? this.rankByRelevance(rest, skip, take, seed) : this.sortInDatabase(rest, dto.sort ?? 'newest', skip, take),
      page === 1 ? this.loadRows(featuredIds) : Promise.resolve([]),
    ]);
    const rows = [...topRows, ...restRows];
    // The rest keep their place, but a featured one among them says so too.
    const marked = await this.featured.featuredAmong(restRows.map((row) => row.id));
    const { categoryNames, optionNames } = await loadListingCardNames(this.taxonomy, rows);
    const results = rows.map((row) => ({
      ...serializeListingCard(row, categoryNames, optionNames),
      featured: featuredIds.includes(row.id) || marked.has(row.id),
    }));

    // R45/R46 — every empty result is demand data, not just the ones where the
    // visitor bothers to leave an email via /search/notify-empty afterwards.
    if (total === 0) {
      await this.recordEmptySearch(dto).catch(() => undefined);
    }

    return { results, total, page, pageSize, featuredIds, seed, indexThreshold: await this.getIndexThreshold() };
  }

  /** "Cena" and "Najnovije": in the database, the id breaking ties so pages never overlap. */
  private async sortInDatabase(
    where: Prisma.ListingWhereInput,
    sort: 'price_asc' | 'price_desc' | 'newest' | 'relevance',
    skip: number,
    take: number,
  ) {
    if (take <= 0) return [];
    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
      sort === 'price_asc'
        ? [{ price: 'asc' }, { id: 'asc' }]
        : sort === 'price_desc'
          ? [{ price: 'desc' }, { id: 'asc' }]
          : [{ publishedAt: 'desc' }, { id: 'asc' }];
    return this.prisma.listing.findMany({ where, orderBy, skip, take, include: this.resultInclude() });
  }

  /**
   * R146: "Preporučeno" mixes rating, freshness, response time and a random
   * part so results don't calcify. Every match is scored from a few columns
   * (it used to be only the 200 newest, so older listings, the first owners'
   * among them, never showed past that), and only the page's cards load.
   * The random part comes from the search's seed, so one search keeps one
   * order across its pages.
   */
  private async rankByRelevance(where: Prisma.ListingWhereInput, skip: number, take: number, seed: string) {
    if (take <= 0) return [];
    const [weights, candidates] = await Promise.all([
      this.getRankingWeights(),
      this.prisma.listing.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: RELEVANCE_MAX_RANKED,
        select: { id: true, avgRating: true, publishedAt: true, user: { select: { avgResponseTimeMinutes: true } } },
      }),
    ]);
    const now = Date.now();
    const scored = candidates.map((listing) => {
      const ratingScore = listing.avgRating ? Number(listing.avgRating) / 5 : 0.5;
      // publishedAt is nullable in the schema even though every real ACTIVE
      // listing sets it on approval — treat a missing value as maximally
      // old rather than letting one bad row 500 the whole search endpoint.
      const ageMs = listing.publishedAt ? now - listing.publishedAt.getTime() : FRESHNESS_FLOOR_MS;
      const freshnessScore = Math.max(0, 1 - ageMs / FRESHNESS_FLOOR_MS);
      const responseScore = listing.user.avgResponseTimeMinutes
        ? Math.max(0, 1 - listing.user.avgResponseTimeMinutes / (24 * 60))
        : 0.5;
      const score =
        weights.rating * ratingScore +
        weights.freshness * freshnessScore +
        weights.responseTime * responseScore +
        weights.random * seededRandom(seed, listing.id);
      return { id: listing.id, score };
    });
    scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    return this.loadRows(scored.slice(skip, skip + take).map((entry) => entry.id));
  }

  /** The cards' rows for these ids, in this order. */
  private async loadRows(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.listing.findMany({ where: { id: { in: ids } }, include: this.resultInclude() });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => !!row);
  }

  private async getRankingWeights(): Promise<RankingWeights> {
    return this.cache.getOrSet(RANKING_WEIGHTS_CACHE_KEY, 300, async () =>
      readRankingWeights((await this.prisma.setting.findUnique({ where: { key: RANKING_WEIGHTS_KEY } }))?.value),
    );
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
        // The body is not validated (an inline type), so an empty pick arrives as ''.
        cityId: dto.cityId || undefined,
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
    const relaxed: SearchListingsDto = { ...dto, cityId: undefined, cityAreaId: undefined, cityAreaIds: undefined, dateFrom: undefined, dateTo: undefined };
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
    // Dizajn 9's filter panel lets a guest tick several parts of a city at
    // once; cityAreaId stays for the single-value callers (Dizajn 8's pill,
    // saved links) and the two are OR-ed into one `in` when both arrive.
    const cityAreaIds = [...new Set([...(dto.cityAreaIds ?? []), ...(dto.cityAreaId ? [dto.cityAreaId] : [])])];
    if (cityAreaIds.length === 1) where.cityAreaId = cityAreaIds[0];
    else if (cityAreaIds.length > 1) where.cityAreaId = { in: cityAreaIds };

    if (dto.priceMin !== undefined || dto.priceMax !== undefined) {
      where.price = {
        ...(dto.priceMin !== undefined ? { gte: rsdToPara(dto.priceMin) } : {}),
        ...(dto.priceMax !== undefined ? { lte: rsdToPara(dto.priceMax) } : {}),
      };
      // T115: "Cena po noći" between two numbers means the listings priced by
      // the night; a month's rent is not a night's price.
      if (dto.priceUnit) where.priceUnit = dto.priceUnit;
    }

    if (dto.guests) {
      where.AND = [
        ...((where.AND as Prisma.ListingWhereInput[]) ?? []),
        { OR: [{ maxGuests: null }, { maxGuests: { gte: dto.guests } }] },
        // Dizajn 23: the capacity from wizard step 6 caps the guests too.
        {
          NOT: {
            attributes: {
              some: { attribute: { key: { in: GUEST_CAPACITY_ATTRIBUTE_KEYS } }, valueNumber: { lt: dto.guests } },
            },
          },
        },
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
      const attributeConditions: Prisma.ListingWhereInput[] = [];
      for (const filter of dto.attributes) {
        // in: attributeIds — a listing only ever has a row under ONE of these
        // (see AttributeFilterInput), so this is effectively "any of these
        // ids has a value matching the rest of the condition".
        const baseMatch: Prisma.ListingAttributeWhereInput = { attributeId: { in: filter.attributeIds } };
        if (filter.min !== undefined || filter.max !== undefined) {
          baseMatch.valueNumber = {
            ...(filter.min !== undefined ? { gte: filter.min } : {}),
            ...(filter.max !== undefined ? { lte: filter.max } : {}),
          };
        }
        if (filter.boolean !== undefined) baseMatch.valueBoolean = filter.boolean;

        if (filter.optionIds?.length) {
          // T62/T64 — one condition per selected option (group), ANDed
          // together: a listing must have EVERY selected amenity, not just
          // some overlap. Within a group, hasSome accepts any of the ids
          // that represent that one logical option (plural only for a
          // merged parent-level filter, where each subcategory stores the
          // "same" amenity under its own AttributeOption row/id).
          for (const group of filter.optionIds) {
            attributeConditions.push({ attributes: { some: { ...baseMatch, valueOptionIds: { hasSome: group } } } });
          }
        } else {
          attributeConditions.push({ attributes: { some: baseMatch } });
        }
      }
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

  /**
   * Dizajn 11 — the "Slični oglasi u <gradu>" row at the foot of a listing
   * page. Same category, the listing's own city first so the row is actually
   * useful to someone already looking at Senjak, then topped up from the rest
   * of the country rather than left half-empty in a city with two listings of
   * that kind. Reuses the search card's serialization so the row renders
   * through the same ListingCard as everywhere else (Dizajn 3).
   */
  async getSimilarListings(slug: string, take = 4) {
    const listing = await this.prisma.listing.findUnique({
      where: { slug },
      select: { id: true, categoryId: true, cityId: true },
    });
    if (!listing) return { results: [] };

    const base: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      available: true,
      categoryId: listing.categoryId,
    };

    const rows = listing.cityId
      ? await this.prisma.listing.findMany({
          where: { ...base, cityId: listing.cityId, id: { not: listing.id } },
          orderBy: { publishedAt: 'desc' },
          take,
          include: this.resultInclude(),
        })
      : [];

    if (rows.length < take) {
      rows.push(
        ...(await this.prisma.listing.findMany({
          where: { ...base, id: { notIn: [listing.id, ...rows.map((r) => r.id)] } },
          orderBy: { publishedAt: 'desc' },
          take: take - rows.length,
          include: this.resultInclude(),
        })),
      );
    }

    if (!rows.length) return { results: [] };

    const { categoryNames, optionNames } = await loadListingCardNames(this.taxonomy, rows);
    return { results: rows.map((r) => serializeListingCard(r, categoryNames, optionNames)) };
  }

  /** The card's own fields (common/utils/listing-card.ts); "Preporučeno" reads its columns in rankByRelevance. */
  private resultInclude() {
    return LISTING_CARD_INCLUDE;
  }

  /** Feeds the frontend's dynamic sitemap — every publicly reachable, genuinely indexable URL. */
  async getSitemapUrls() {
    const [listings, categories, cityCategoryGroups, threshold] = await Promise.all([
      this.prisma.listing.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true, publishedAt: true },
      }),
      // Dizajn 50: a category the admin hasn't published has no public page.
      this.prisma.category.findMany({
        where: { status: 'ACTIVE', published: true },
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
      this.prisma.category.findMany({ where: { id: { in: categoryIds }, published: true }, select: { id: true, slug: true } }),
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
}
