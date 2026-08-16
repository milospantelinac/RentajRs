"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/cache/cache.service");
const taxonomy_service_1 = require("../taxonomy/taxonomy.service");
const money_1 = require("../../common/utils/money");
const RELEVANCE_CANDIDATE_POOL = 200;
const DEFAULT_PAGE_SIZE = 20;
const RANKING_WEIGHTS_CACHE_KEY = 'settings:ranking_weights';
let SearchService = class SearchService {
    constructor(prisma, cache, taxonomy) {
        this.prisma = prisma;
        this.cache = cache;
        this.taxonomy = taxonomy;
    }
    async getFilterableAttributes(categorySlug) {
        const category = await this.prisma.category.findUniqueOrThrow({ where: { slug: categorySlug } });
        const attributes = await this.taxonomy.resolveAttributesForCategory(category.id);
        return attributes.filter((a) => a.isFilter);
    }
    async search(dto) {
        const page = dto.page ?? 1;
        const pageSize = Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, 50);
        const where = await this.buildWhere(dto);
        const result = dto.sort && dto.sort !== 'relevance'
            ? await this.searchWithDbSort(where, dto.sort, page, pageSize)
            : await this.searchWithRelevanceRanking(where, page, pageSize);
        if (result.total === 0) {
            await this.recordEmptySearch(dto).catch(() => undefined);
        }
        return { ...result, indexThreshold: await this.getIndexThreshold() };
    }
    async searchWithDbSort(where, sort, page, pageSize) {
        const orderBy = sort === 'price_asc'
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
    async searchWithRelevanceRanking(where, page, pageSize) {
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
        const maxAgeMs = 1000 * 60 * 60 * 24 * 90;
        const scored = candidates.map((listing) => {
            const ratingScore = listing.avgRating ? Number(listing.avgRating) / 5 : 0.5;
            const ageMs = now - listing.publishedAt.getTime();
            const freshnessScore = Math.max(0, 1 - ageMs / maxAgeMs);
            const responseScore = listing.user.avgResponseTimeMinutes
                ? Math.max(0, 1 - listing.user.avgResponseTimeMinutes / (24 * 60))
                : 0.5;
            const randomScore = Math.random();
            const score = weights.rating * ratingScore +
                weights.freshness * freshnessScore +
                weights.responseTime * responseScore +
                weights.random * randomScore;
            return { listing, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const pageItems = scored.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
        return { results: pageItems.map((s) => this.serializeResult(s.listing)), total, page, pageSize };
    }
    async getRankingWeights() {
        return this.cache.getOrSet(RANKING_WEIGHTS_CACHE_KEY, 300, async () => {
            const setting = await this.prisma.setting.findUnique({ where: { key: 'ranking_weights' } });
            return setting?.value ?? { rating: 0.35, freshness: 0.25, responseTime: 0.2, random: 0.2 };
        });
    }
    async recordEmptySearch(dto, notifyEmail) {
        let categoryId;
        if (dto.categorySlug) {
            const category = await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } });
            categoryId = category?.id;
        }
        await this.prisma.emptySearch.create({
            data: {
                query: dto.q,
                categoryId,
                cityId: dto.cityId,
                filters: dto,
                notifyEmail,
            },
        });
        return { message: 'ok' };
    }
    async getIndexedCitiesForCategory(categorySlug) {
        const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
        if (!category)
            return [];
        const categoryIds = await this.categorySubtreeIds(category.id);
        const threshold = await this.getIndexThreshold();
        const groups = await this.prisma.listing.groupBy({
            by: ['cityId'],
            where: { status: 'ACTIVE', categoryId: { in: categoryIds }, cityId: { not: null } },
            _count: { _all: true },
        });
        const qualifyingCityIds = groups.filter((g) => g._count._all >= threshold).map((g) => g.cityId);
        if (!qualifyingCityIds.length)
            return [];
        return this.prisma.city.findMany({
            where: { id: { in: qualifyingCityIds } },
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });
    }
    async relaxedSearch(dto) {
        const relaxed = { ...dto, cityId: undefined, cityAreaId: undefined, dateFrom: undefined, dateTo: undefined };
        return this.search(relaxed);
    }
    async buildWhere(dto) {
        const where = {
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
                where.categoryId = { in: await this.categorySubtreeIds(category.id) };
            }
        }
        if (dto.regionId)
            where.regionId = dto.regionId;
        if (dto.cityId)
            where.cityId = dto.cityId;
        if (dto.cityAreaId)
            where.cityAreaId = dto.cityAreaId;
        if (dto.priceMin !== undefined || dto.priceMax !== undefined) {
            where.price = {
                ...(dto.priceMin !== undefined ? { gte: (0, money_1.rsdToPara)(dto.priceMin) } : {}),
                ...(dto.priceMax !== undefined ? { lte: (0, money_1.rsdToPara)(dto.priceMax) } : {}),
            };
        }
        if (dto.guests) {
            where.AND = [
                ...(where.AND ?? []),
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
            const attributeConditions = dto.attributes.map((filter) => {
                const attributeMatch = { attributeId: filter.attributeId };
                if (filter.min !== undefined || filter.max !== undefined) {
                    attributeMatch.valueNumber = {
                        ...(filter.min !== undefined ? { gte: filter.min } : {}),
                        ...(filter.max !== undefined ? { lte: filter.max } : {}),
                    };
                }
                if (filter.boolean !== undefined)
                    attributeMatch.valueBoolean = filter.boolean;
                if (filter.optionIds?.length)
                    attributeMatch.valueOptionIds = { hasSome: filter.optionIds };
                return { attributes: { some: attributeMatch } };
            });
            where.AND = [...(where.AND ?? []), ...attributeConditions];
        }
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
    resultInclude() {
        return {
            photos: { where: { isCover: true, pendingRemoval: false, versionId: null }, take: 1 },
            category: true,
            city: true,
            cityArea: true,
            user: { select: { avgResponseTimeMinutes: true } },
        };
    }
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
        const qualifying = cityCategoryGroups.filter((g) => g._count._all >= threshold && g.cityId);
        const categoryIds = [...new Set(qualifying.map((g) => g.categoryId))];
        const cityIds = [...new Set(qualifying.map((g) => g.cityId))];
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
                citySlug: citySlugById.get(g.cityId),
            }))
                .filter((g) => !!g.categorySlug && !!g.citySlug),
        };
    }
    async categorySubtreeIds(rootId) {
        const ids = [rootId];
        let frontier = [rootId];
        for (let depth = 0; depth < 2 && frontier.length; depth++) {
            const children = await this.prisma.category.findMany({
                where: { parentId: { in: frontier } },
                select: { id: true },
            });
            if (!children.length)
                break;
            frontier = children.map((c) => c.id);
            ids.push(...frontier);
        }
        return ids;
    }
    async getIndexThreshold() {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'listing_index_threshold' } });
        return typeof setting?.value === 'number' ? setting.value : 3;
    }
    serializeResult(listing) {
        return {
            id: listing.id,
            slug: listing.slug,
            title: listing.title,
            price: (0, money_1.paraToRsd)(listing.price),
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
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        taxonomy_service_1.TaxonomyService])
], SearchService);
//# sourceMappingURL=search.service.js.map