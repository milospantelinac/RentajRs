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
exports.TaxonomyService = exports.FALLBACK_CATEGORY_SLUG = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/cache/cache.service");
const CACHE_TTL = 60 * 30;
const FUZZY_THRESHOLD = 0.35;
exports.FALLBACK_CATEGORY_SLUG = 'ostalo';
let TaxonomyService = class TaxonomyService {
    constructor(prisma, cache, i18n, events) {
        this.prisma = prisma;
        this.cache = cache;
        this.i18n = i18n;
        this.events = events;
    }
    async getCategoryTree() {
        return this.cache.getOrSet('taxonomy:tree', CACHE_TTL, async () => {
            const categories = await this.prisma.category.findMany({
                where: { status: 'ACTIVE' },
                orderBy: { displayOrder: 'asc' },
            });
            const names = await this.getTranslationMap('CATEGORY', categories.map((c) => c.id));
            const byParent = new Map();
            for (const cat of categories) {
                const key = cat.parentId ?? 'root';
                if (!byParent.has(key))
                    byParent.set(key, []);
                byParent.get(key).push(cat);
            }
            const toNode = (cat) => ({
                id: cat.id,
                slug: cat.slug,
                icon: cat.icon,
                name: names.get(cat.id) ?? cat.slug,
                listingCount: cat.listingCount,
                children: (byParent.get(cat.id) ?? []).map(toNode),
            });
            return (byParent.get('root') ?? []).map(toNode);
        });
    }
    async getCategoryBySlug(slug) {
        const cached = await this.cache.get(`taxonomy:category:${slug}`);
        if (cached)
            return cached;
        const category = await this.prisma.category.findUnique({ where: { slug } });
        if (!category || category.status === 'ARCHIVED') {
            throw new common_1.NotFoundException();
        }
        const [name, description] = await Promise.all([
            this.getTranslation('CATEGORY', category.id, 'name'),
            this.getTranslation('CATEGORY', category.id, 'description'),
        ]);
        const attributes = await this.resolveAttributesForCategory(category.id);
        const childCategories = await this.prisma.category.findMany({
            where: { parentId: category.id, status: 'ACTIVE' },
            orderBy: { displayOrder: 'asc' },
        });
        const childNames = await this.getTranslationMap('CATEGORY', childCategories.map((c) => c.id));
        const children = childCategories.map((c) => ({ id: c.id, slug: c.slug, name: childNames.get(c.id) ?? c.slug }));
        const result = { ...category, name: name ?? category.slug, description, attributes, children };
        await this.cache.set(`taxonomy:category:${slug}`, result, CACHE_TTL);
        return result;
    }
    async resolveAttributesForCategory(categoryId) {
        return this.cache.getOrSet(`taxonomy:attributes:${categoryId}`, CACHE_TTL, async () => {
            const chain = [];
            let current = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, parentId: true } });
            while (current) {
                chain.unshift(current.id);
                current = current.parentId
                    ? await this.prisma.category.findUnique({
                        where: { id: current.parentId },
                        select: { id: true, parentId: true },
                    })
                    : null;
            }
            const attributes = await this.prisma.categoryAttribute.findMany({
                where: { categoryId: { in: chain } },
                include: { options: true },
                orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }],
            });
            attributes.sort((a, b) => chain.indexOf(a.categoryId) - chain.indexOf(b.categoryId));
            const attributeNames = await this.getTranslationMap('ATTRIBUTE', attributes.map((a) => a.id));
            const allOptionIds = attributes.flatMap((a) => a.options.map((o) => o.id));
            const optionNames = await this.getTranslationMap('OPTION', allOptionIds);
            return attributes.map((attr) => ({
                id: attr.id,
                categoryId: attr.categoryId,
                key: attr.key,
                name: attributeNames.get(attr.id) ?? attr.key,
                type: attr.type,
                required: attr.required,
                unit: attr.unit,
                isFilter: attr.isFilter,
                filterType: attr.filterType,
                showOnCard: attr.showOnCard,
                dependsOnAttrKey: attr.dependsOnAttrKey,
                dependsOnOptionKey: attr.dependsOnOptionKey,
                minValue: attr.minValue,
                maxValue: attr.maxValue,
                options: attr.options.map((o) => ({ id: o.id, key: o.key, name: optionNames.get(o.id) ?? o.key })),
            }));
        });
    }
    async getRegions() {
        return this.cache.getOrSet('taxonomy:regions', CACHE_TTL, () => this.prisma.region.findMany({ orderBy: { name: 'asc' } }));
    }
    async getCities(regionId) {
        const key = `taxonomy:cities:${regionId ?? 'all'}`;
        return this.cache.getOrSet(key, CACHE_TTL, () => this.prisma.city.findMany({ where: regionId ? { regionId } : undefined, orderBy: { name: 'asc' } }));
    }
    async getCityAreas(citySlug) {
        return this.cache.getOrSet(`taxonomy:areas:${citySlug}`, CACHE_TTL, async () => {
            const city = await this.prisma.city.findUnique({ where: { slug: citySlug } });
            if (!city)
                throw new common_1.NotFoundException();
            return this.prisma.cityArea.findMany({ where: { cityId: city.id }, orderBy: { name: 'asc' } });
        });
    }
    async checkDuplicateCategory(parentId, name) {
        const matches = await this.prisma.$queryRaw `
      SELECT c."id", c."slug", similarity(t."value", ${name}) AS similarity
      FROM "Category" c
      JOIN "Translation" t ON t."entityType" = 'CATEGORY' AND t."entityId" = c."id" AND t."field" = 'name' AND t."language" = 'SR'
      WHERE c."parentId" = ${parentId}::uuid
        AND c."status" IN ('ACTIVE', 'PROPOSED')
        AND similarity(t."value", ${name}) > ${FUZZY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;
        return Promise.all(matches.map(async (m) => ({
            id: m.id,
            slug: m.slug,
            name: await this.getTranslation('CATEGORY', m.id, 'name'),
            similarity: m.similarity,
        })));
    }
    async proposeCategory(userId, dto) {
        const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
        if (!parent)
            throw new common_1.NotFoundException();
        if (parent.level >= 3)
            throw new common_1.BadRequestException(this.i18n.t('errors.CATEGORY_MAX_DEPTH'));
        const duplicates = await this.checkDuplicateCategory(dto.parentId, dto.name);
        const existingProposal = duplicates.find((d) => d.similarity > 0.6);
        if (existingProposal) {
            const category = await this.prisma.category.update({
                where: { id: existingProposal.id },
                data: { proposalCount: { increment: 1 } },
            });
            if (category.proposalCount >= 5) {
                this.events.emit('taxonomy.category_proposal_priority', { categoryId: category.id });
            }
            return { ...category, name: existingProposal.name, joinedExisting: true };
        }
        const slug = await this.uniqueSlug(dto.name);
        const category = await this.prisma.category.create({
            data: {
                parentId: dto.parentId,
                level: parent.level + 1,
                slug,
                status: 'PROPOSED',
                defaultBookingModel: dto.bookingModel,
                allowedPriceUnits: [dto.priceUnit],
                defaultPriceUnit: dto.priceUnit,
                proposedByUserId: userId,
                proposalComment: dto.comment,
                proposalCount: 1,
            },
        });
        await this.setTranslation('CATEGORY', category.id, 'name', dto.name);
        await this.invalidateTreeCache();
        this.events.emit('taxonomy.category_proposed', { categoryId: category.id, userId });
        return { ...category, name: dto.name, joinedExisting: false };
    }
    async adminGetCategoryTree() {
        const categories = await this.prisma.category.findMany({ orderBy: [{ level: 'asc' }, { displayOrder: 'asc' }] });
        const names = await this.getTranslationMap('CATEGORY', categories.map((c) => c.id));
        return categories.map((c) => ({ ...c, name: names.get(c.id) ?? c.slug }));
    }
    async adminListProposedCategories() {
        const categories = await this.prisma.category.findMany({
            where: { status: 'PROPOSED' },
            orderBy: { proposalCount: 'desc' },
            include: { parent: true, proposedByUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
        });
        const names = await this.getTranslationMap('CATEGORY', categories.flatMap((c) => [c.id, ...(c.parent ? [c.parent.id] : [])]));
        return categories.map((c) => ({
            ...c,
            name: names.get(c.id) ?? c.slug,
            parentName: c.parent ? (names.get(c.parent.id) ?? c.parent.slug) : null,
        }));
    }
    async adminCreateCategory(dto) {
        let level = 1;
        if (dto.parentId) {
            const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
            if (!parent)
                throw new common_1.NotFoundException();
            if (parent.level >= 3)
                throw new common_1.BadRequestException(this.i18n.t('errors.CATEGORY_MAX_DEPTH'));
            level = parent.level + 1;
        }
        const slug = await this.uniqueSlug(dto.name);
        const category = await this.prisma.category.create({
            data: {
                parentId: dto.parentId ?? null,
                level,
                slug,
                icon: dto.icon,
                status: 'ACTIVE',
                defaultBookingModel: dto.defaultBookingModel,
                allowedPriceUnits: dto.allowedPriceUnits,
                defaultPriceUnit: dto.defaultPriceUnit,
                displayOrder: dto.displayOrder ?? 0,
            },
        });
        await this.setTranslation('CATEGORY', category.id, 'name', dto.name);
        if (dto.description)
            await this.setTranslation('CATEGORY', category.id, 'description', dto.description);
        await this.invalidateTreeCache();
        return category;
    }
    async adminUpdateCategory(id, dto) {
        const category = await this.prisma.category.findUnique({ where: { id } });
        if (!category)
            throw new common_1.NotFoundException();
        await this.prisma.category.update({
            where: { id },
            data: {
                icon: dto.icon,
                defaultBookingModel: dto.defaultBookingModel,
                allowedPriceUnits: dto.allowedPriceUnits,
                defaultPriceUnit: dto.defaultPriceUnit,
                displayOrder: dto.displayOrder,
            },
        });
        if (dto.name)
            await this.setTranslation('CATEGORY', id, 'name', dto.name);
        if (dto.description)
            await this.setTranslation('CATEGORY', id, 'description', dto.description);
        await this.invalidateTreeCache(id);
        return this.prisma.category.findUnique({ where: { id } });
    }
    async adminApproveCategory(id) {
        const category = await this.prisma.category.update({ where: { id }, data: { status: 'ACTIVE' } });
        await this.invalidateTreeCache();
        if (category.proposedByUserId) {
            this.events.emit('taxonomy.category_approved', { categoryId: id, userId: category.proposedByUserId });
        }
        return category;
    }
    async adminRejectCategory(id, dto) {
        const category = await this.prisma.category.findUnique({ where: { id } });
        if (!category)
            throw new common_1.NotFoundException();
        const fallback = await this.prisma.category.findUniqueOrThrow({ where: { slug: exports.FALLBACK_CATEGORY_SLUG } });
        await this.prisma.$transaction([
            this.prisma.listing.updateMany({ where: { categoryId: id }, data: { categoryId: fallback.id } }),
            this.prisma.category.update({ where: { id }, data: { status: 'ARCHIVED' } }),
        ]);
        await this.invalidateTreeCache();
        if (category.proposedByUserId) {
            this.events.emit('taxonomy.category_rejected', {
                categoryId: id,
                userId: category.proposedByUserId,
                reason: dto.reason,
            });
        }
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async adminMergeCategory(id, dto) {
        const [source, target] = await Promise.all([
            this.prisma.category.findUniqueOrThrow({ where: { id } }),
            this.prisma.category.findUniqueOrThrow({ where: { id: dto.targetCategoryId } }),
        ]);
        const affectedListingOwners = await this.prisma.listing.findMany({
            where: { categoryId: id },
            select: { userId: true },
            distinct: ['userId'],
        });
        await this.prisma.$transaction([
            this.prisma.listing.updateMany({ where: { categoryId: id }, data: { categoryId: target.id } }),
            this.prisma.category.update({ where: { id }, data: { status: 'MERGED', mergedIntoId: target.id } }),
            this.prisma.redirect.create({
                data: { oldPath: `/${source.slug}`, newPath: `/${target.slug}`, type: 301 },
            }),
        ]);
        await this.invalidateTreeCache();
        for (const owner of affectedListingOwners) {
            this.events.emit('taxonomy.category_merged', { userId: owner.userId, fromSlug: source.slug, toSlug: target.slug });
        }
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async adminPromoteCategory(id) {
        const category = await this.prisma.category.findUniqueOrThrow({ where: { id } });
        const oldSlug = category.slug;
        await this.prisma.category.update({ where: { id }, data: { parentId: null, level: 1 } });
        await this.prisma.redirect.create({ data: { oldPath: `/${oldSlug}`, newPath: `/${category.slug}`, type: 301 } });
        await this.invalidateTreeCache();
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async adminUpsertAttribute(categoryId, dto) {
        const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
        if (!category)
            throw new common_1.NotFoundException();
        const attribute = await this.prisma.categoryAttribute.upsert({
            where: { categoryId_key: { categoryId, key: dto.key } },
            update: {
                type: dto.type,
                required: dto.required ?? false,
                unit: dto.unit,
                isFilter: dto.isFilter ?? false,
                filterType: dto.filterType,
                displayOrder: dto.displayOrder ?? 0,
            },
            create: {
                categoryId,
                key: dto.key,
                type: dto.type,
                required: dto.required ?? false,
                unit: dto.unit,
                isFilter: dto.isFilter ?? false,
                filterType: dto.filterType,
                displayOrder: dto.displayOrder ?? 0,
            },
        });
        await this.setTranslation('ATTRIBUTE', attribute.id, 'name', dto.name);
        if (dto.options?.length) {
            for (const [i, opt] of dto.options.entries()) {
                const option = await this.prisma.attributeOption.upsert({
                    where: { attributeId_key: { attributeId: attribute.id, key: opt.key } },
                    update: { displayOrder: i },
                    create: { attributeId: attribute.id, key: opt.key, displayOrder: i },
                });
                await this.setTranslation('OPTION', option.id, 'name', opt.name);
            }
        }
        await this.invalidateTreeCache(categoryId);
        return attribute;
    }
    async adminDeleteAttribute(attributeId) {
        const usageCount = await this.prisma.listingAttribute.count({ where: { attributeId } });
        if (usageCount > 0) {
            throw new common_1.BadRequestException(`${usageCount} listing(s) use this attribute — remove it from the category form instead of deleting`);
        }
        const attribute = await this.prisma.categoryAttribute.delete({ where: { id: attributeId } });
        await this.invalidateTreeCache(attribute.categoryId);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async getTranslation(entityType, entityId, field, language = client_1.Language.SR) {
        const row = await this.prisma.translation.findUnique({
            where: { entityType_entityId_field_language: { entityType, entityId, field, language } },
        });
        return row?.value ?? null;
    }
    async getTranslationMap(entityType, entityIds, field = 'name', language = client_1.Language.SR) {
        if (entityIds.length === 0)
            return new Map();
        const rows = await this.prisma.translation.findMany({
            where: { entityType, entityId: { in: entityIds }, field, language },
        });
        return new Map(rows.map((r) => [r.entityId, r.value]));
    }
    async setTranslation(entityType, entityId, field, value, language = client_1.Language.SR) {
        await this.prisma.translation.upsert({
            where: { entityType_entityId_field_language: { entityType, entityId, field, language } },
            update: { value },
            create: { entityType, entityId, field, language, value },
        });
    }
    async uniqueSlug(name) {
        const base = slugify(name);
        let candidate = base;
        let suffix = 1;
        while (await this.prisma.category.findUnique({ where: { slug: candidate } })) {
            suffix += 1;
            candidate = `${base}-${suffix}`;
        }
        return candidate;
    }
    async invalidateTreeCache(categoryId) {
        await this.cache.del('taxonomy:tree');
        await this.cache.delByPrefix('taxonomy:category:');
        await this.cache.delByPrefix('taxonomy:attributes:');
    }
};
exports.TaxonomyService = TaxonomyService;
exports.TaxonomyService = TaxonomyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], TaxonomyService);
function slugify(input) {
    const map = {
        č: 'c',
        ć: 'c',
        ž: 'z',
        š: 's',
        đ: 'dj',
        Č: 'c',
        Ć: 'c',
        Ž: 'z',
        Š: 's',
        Đ: 'dj',
    };
    return input
        .split('')
        .map((ch) => map[ch] ?? ch)
        .join('')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
//# sourceMappingURL=taxonomy.service.js.map