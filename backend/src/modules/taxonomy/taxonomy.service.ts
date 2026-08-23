import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Language } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { ProposeCategoryDto } from './dto/propose-category.dto';
import {
  CreateCategoryDto,
  MergeCategoryDto,
  RejectCategoryDto,
  UpdateCategoryDto,
  UpsertAttributeDto,
} from './dto/admin-category.dto';

const CACHE_TTL = 60 * 30; // 30 min — categories/attributes change rarely and are admin-invalidated below
const FUZZY_THRESHOLD = 0.35;
export const FALLBACK_CATEGORY_SLUG = 'ostalo';

@Injectable()
export class TaxonomyService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  // -- Reads (public) ------------------------------------------------------

  /** Two-level navigation (R49): main categories, each with its direct children. */
  async getCategoryTree() {
    return this.cache.getOrSet('taxonomy:tree', CACHE_TTL, async () => {
      const categories = await this.prisma.category.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { displayOrder: 'asc' },
      });
      const names = await this.getTranslationMap('CATEGORY', categories.map((c) => c.id));

      const byParent = new Map<string, typeof categories>();
      for (const cat of categories) {
        const key = cat.parentId ?? 'root';
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(cat);
      }

      const toNode = (cat: (typeof categories)[number]): any => ({
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

  async getCategoryBySlug(slug: string) {
    const cached = await this.cache.get(`taxonomy:category:${slug}`);
    if (cached) return cached;

    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || category.status === 'ARCHIVED') {
      throw new NotFoundException();
    }

    const [name, description] = await Promise.all([
      this.getTranslation('CATEGORY', category.id, 'name'),
      this.getTranslation('CATEGORY', category.id, 'description'),
    ]);
    const attributes = await this.resolveAttributesForCategory(category.id);

    // RNT-098 — the subcategory pages themselves render fine, but nothing
    // ever linked to them; the parent category page is the first place a
    // browsing guest would expect to find them.
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

  /**
   * ADR-010 / R2: walks the category up to its root, merging every ancestor's
   * attributes. A subcategory's own attributes are appended after (and can
   * share a display area with) its parent's — nothing is ever copied into the
   * child row, so editing a parent attribute reaches every descendant
   * instantly without a data migration.
   */
  async resolveAttributesForCategory(categoryId: string) {
    return this.cache.getOrSet(`taxonomy:attributes:${categoryId}`, CACHE_TTL, async () => {
      const chain: string[] = [];
      let current: { id: string; parentId: string | null } | null =
        await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, parentId: true } });
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
      // Re-order to match root->leaf chain order rather than arbitrary categoryId order.
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
        // Kategorije spec §5 (Mašine) — lets the wizard/detail page only show
        // this attribute once the sibling `dependsOnAttrKey` attribute has
        // `dependsOnOptionKey` selected.
        dependsOnAttrKey: attr.dependsOnAttrKey,
        dependsOnOptionKey: attr.dependsOnOptionKey,
        minValue: attr.minValue,
        maxValue: attr.maxValue,
        options: attr.options.map((o) => ({ id: o.id, key: o.key, name: optionNames.get(o.id) ?? o.key })),
      }));
    });
  }

  // -- Locations -------------------------------------------------------

  async getRegions() {
    return this.cache.getOrSet('taxonomy:regions', CACHE_TTL, () =>
      this.prisma.region.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async getCities(regionId?: string) {
    const key = `taxonomy:cities:${regionId ?? 'all'}`;
    return this.cache.getOrSet(key, CACHE_TTL, () =>
      this.prisma.city.findMany({ where: regionId ? { regionId } : undefined, orderBy: { name: 'asc' } }),
    );
  }

  async getCityAreas(citySlug: string) {
    return this.cache.getOrSet(`taxonomy:areas:${citySlug}`, CACHE_TTL, async () => {
      const city = await this.prisma.city.findUnique({ where: { slug: citySlug } });
      if (!city) throw new NotFoundException();
      return this.prisma.cityArea.findMany({ where: { cityId: city.id }, orderBy: { name: 'asc' } });
    });
  }

  // -- Proposal flow (ADR-001) -------------------------------------------

  /** "Da li ste mislili: X?" — called as the owner types, before they submit a proposal. */
  async checkDuplicateCategory(parentId: string, name: string) {
    const matches = await this.prisma.$queryRaw<Array<{ id: string; slug: string; similarity: number }>>`
      SELECT c."id", c."slug", similarity(t."value", ${name}) AS similarity
      FROM "Category" c
      JOIN "Translation" t ON t."entityType" = 'CATEGORY' AND t."entityId" = c."id" AND t."field" = 'name' AND t."language" = 'SR'
      WHERE c."parentId" = ${parentId}::uuid
        AND c."status" IN ('ACTIVE', 'PROPOSED')
        AND similarity(t."value", ${name}) > ${FUZZY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;
    return Promise.all(
      matches.map(async (m) => ({
        id: m.id,
        slug: m.slug,
        name: await this.getTranslation('CATEGORY', m.id, 'name'),
        similarity: m.similarity,
      })),
    );
  }

  async proposeCategory(userId: string, dto: ProposeCategoryDto) {
    const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
    if (!parent) throw new NotFoundException();
    // R24 — same app-level check adminCreateCategory() already has; without
    // it here, only the DB trigger catches an over-deep proposal, with a
    // generic un-localized error instead of this one.
    if (parent.level >= 3) throw new BadRequestException(this.i18n.t('errors.CATEGORY_MAX_DEPTH'));

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

  /** Batch name lookup for arbitrary category ids — e.g. decorating search results with display names. */
  async getCategoryNames(categoryIds: string[], language: Language = Language.SR): Promise<Map<string, string>> {
    return this.getTranslationMap('CATEGORY', categoryIds, 'name', language);
  }

  // -- Admin ---------------------------------------------------------------

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
    const names = await this.getTranslationMap(
      'CATEGORY',
      categories.flatMap((c) => [c.id, ...(c.parent ? [c.parent.id] : [])]),
    );
    return categories.map((c) => ({
      ...c,
      name: names.get(c.id) ?? c.slug,
      parentName: c.parent ? (names.get(c.parent.id) ?? c.parent.slug) : null,
    }));
  }

  async adminCreateCategory(dto: CreateCategoryDto) {
    let level = 1;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException();
      if (parent.level >= 3) throw new BadRequestException(this.i18n.t('errors.CATEGORY_MAX_DEPTH'));
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
    if (dto.description) await this.setTranslation('CATEGORY', category.id, 'description', dto.description);
    await this.invalidateTreeCache();
    return category;
  }

  async adminUpdateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();

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
    if (dto.name) await this.setTranslation('CATEGORY', id, 'name', dto.name);
    if (dto.description) await this.setTranslation('CATEGORY', id, 'description', dto.description);
    await this.invalidateTreeCache(id);
    return this.prisma.category.findUnique({ where: { id } });
  }

  async adminApproveCategory(id: string) {
    const category = await this.prisma.category.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.invalidateTreeCache();
    if (category.proposedByUserId) {
      this.events.emit('taxonomy.category_approved', { categoryId: id, userId: category.proposedByUserId });
    }
    return category;
  }

  /** R6: rejected proposals' listings fall back to the hidden "Ostalo" parent. */
  async adminRejectCategory(id: string, dto: RejectCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    const fallback = await this.prisma.category.findUniqueOrThrow({ where: { slug: FALLBACK_CATEGORY_SLUG } });

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

  /** R6/R134: merge moves listings + writes a permanent redirect for the old URL. */
  async adminMergeCategory(id: string, dto: MergeCategoryDto) {
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

  /** R8: promoting a subcategory to a main category — old URL gets a permanent redirect. */
  async adminPromoteCategory(id: string) {
    const category = await this.prisma.category.findUniqueOrThrow({ where: { id } });
    const oldSlug = category.slug;
    await this.prisma.category.update({ where: { id }, data: { parentId: null, level: 1 } });
    await this.prisma.redirect.create({ data: { oldPath: `/${oldSlug}`, newPath: `/${category.slug}`, type: 301 } });
    await this.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Admin: attributes -----------------------------------------------

  async adminUpsertAttribute(categoryId: string, dto: UpsertAttributeDto) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException();

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

  async adminDeleteAttribute(attributeId: string) {
    const usageCount = await this.prisma.listingAttribute.count({ where: { attributeId } });
    if (usageCount > 0) {
      throw new BadRequestException(
        `${usageCount} listing(s) use this attribute — remove it from the category form instead of deleting`,
      );
    }
    const attribute = await this.prisma.categoryAttribute.delete({ where: { id: attributeId } });
    await this.invalidateTreeCache(attribute.categoryId);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Internal helpers ------------------------------------------------

  private async getTranslation(
    entityType: 'CATEGORY' | 'ATTRIBUTE' | 'OPTION' | 'PAGE',
    entityId: string,
    field: string,
    language: Language = Language.SR,
  ): Promise<string | null> {
    const row = await this.prisma.translation.findUnique({
      where: { entityType_entityId_field_language: { entityType, entityId, field, language } },
    });
    return row?.value ?? null;
  }

  private async getTranslationMap(
    entityType: 'CATEGORY' | 'ATTRIBUTE' | 'OPTION' | 'PAGE',
    entityIds: string[],
    field = 'name',
    language: Language = Language.SR,
  ): Promise<Map<string, string>> {
    if (entityIds.length === 0) return new Map();
    const rows = await this.prisma.translation.findMany({
      where: { entityType, entityId: { in: entityIds }, field, language },
    });
    return new Map(rows.map((r) => [r.entityId, r.value]));
  }

  private async setTranslation(
    entityType: 'CATEGORY' | 'ATTRIBUTE' | 'OPTION' | 'PAGE',
    entityId: string,
    field: string,
    value: string,
    language: Language = Language.SR,
  ) {
    await this.prisma.translation.upsert({
      where: { entityType_entityId_field_language: { entityType, entityId, field, language } },
      update: { value },
      create: { entityType, entityId, field, language, value },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.category.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private async invalidateTreeCache(categoryId?: string) {
    await this.cache.del('taxonomy:tree');
    await this.cache.delByPrefix('taxonomy:category:');
    await this.cache.delByPrefix('taxonomy:attributes:');
  }
}

function slugify(input: string): string {
  const map: Record<string, string> = {
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
