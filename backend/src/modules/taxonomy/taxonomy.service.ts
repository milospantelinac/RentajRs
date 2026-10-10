import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Language } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { UploadsService } from '../../common/uploads/uploads.service';
import { ProposeCategoryDto } from './dto/propose-category.dto';
import {
  CreateCategoryDto,
  MergeCategoryDto,
  RejectCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
  UpsertAttributeDto,
} from './dto/admin-category.dto';

const CACHE_TTL = 60 * 30; // 30 min — categories/attributes change rarely and are admin-invalidated below
// The backend drops every taxonomy key whenever it connects to Redis
// (DERIVED_KEY_PREFIXES), so a deploy never serves a shape cached before it.
// Bump the suffix anyway when a tree node gains or loses a field, for an old
// instance still writing during a rolling deploy. v3: the listing counts
// moved to their own key. v4: Dizajn 50 picks the categories by the published
// flag, where an older instance left Ostalo out by its slug.
const TREE_CACHE_KEY = 'taxonomy:tree:v4';
/**
 * Live listings per category (getListingCounts). Kept apart from the tree,
 * which changes only when an admin edits a category: the counts change
 * whenever a listing goes live or leaves search, and every write that can do
 * that deletes this key (a listing's status, availability or category, a
 * package running out or renewed, account deletion, a category merge or
 * rejection).
 */
export const LISTING_COUNTS_CACHE_KEY = 'taxonomy:listing-counts';
// Short, so a count is never off for long: not after a missed delete, and not
// when a read that started before a write stores the old number after it.
const LISTING_COUNTS_TTL = 60;
/** T115: SearchService.getSearchFilters, one key per category page; dropped with the tree. */
export const SEARCH_FILTERS_CACHE_PREFIX = 'taxonomy:search-filters:v1:';
const FUZZY_THRESHOLD = 0.35;
export const FALLBACK_CATEGORY_SLUG = 'ostalo';
/** T129: lowercase ASCII words joined by single hyphens, as uniqueSlug makes them. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type CategoryNode = {
  id: string;
  slug: string;
  icon: string | null;
  name: string;
  shortDescription: string | null;
  children: CategoryNode[];
};
type CountedCategoryNode = Omit<CategoryNode, 'children'> & {
  listingCount: number;
  children: CountedCategoryNode[];
};

@Injectable()
export class TaxonomyService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private i18n: I18nService,
    private events: EventEmitter2,
    private uploads: UploadsService,
  ) {}

  // -- Reads (public) ------------------------------------------------------

  /** Two-level navigation (R49): main categories, their direct children and live listing counts. */
  async getCategoryTree(): Promise<CountedCategoryNode[]> {
    const [tree, counts] = await Promise.all([this.getCategoryStructure(), this.getListingCounts()]);

    // A parent's count is its whole subtree (R49): "Sve nekretnine" has to
    // equal Stanovi + Kuće + Sobe plus anything filed on the parent itself,
    // which is also how a search on the parent slug matches (categorySubtreeIds).
    const withCounts = (node: CategoryNode): CountedCategoryNode => {
      const children = node.children.map(withCounts);
      const listingCount =
        (counts[node.id] ?? 0) + children.reduce((sum, child) => sum + child.listingCount, 0);
      return { ...node, listingCount, children };
    };
    return tree.map(withCounts);
  }

  /**
   * Category.listingCount is a denormalised column the schema describes as
   * "refreshed by a scheduled job"; that job was never written, so the column
   * always reads 0. Counted live instead, one grouped query per
   * LISTING_COUNTS_TTL, with the filter search.service.ts's buildWhere starts
   * from (ACTIVE and not switched to "trenutno nedostupno"), so the number on a
   * /pretraga chip is what picking it finds.
   */
  private async getListingCounts(): Promise<Record<string, number>> {
    return this.cache.getOrSet(LISTING_COUNTS_CACHE_KEY, LISTING_COUNTS_TTL, async () => {
      const rows = await this.prisma.listing.groupBy({
        by: ['categoryId'],
        where: { status: 'ACTIVE', available: true },
        _count: { _all: true },
      });
      return Object.fromEntries(rows.map((row) => [row.categoryId, row._count._all]));
    });
  }

  /** The tree as admins shape it, without counts; the admin methods below drop it on every change. */
  private async getCategoryStructure(): Promise<CategoryNode[]> {
    return this.cache.getOrSet(TREE_CACHE_KEY, CACHE_TTL, async () => {
      const categories = await this.prisma.category.findMany({
        // Dizajn 50: only what an admin has published. This used to leave out
        // "Ostalo" by its slug (T60); it is now the seventh category, hidden
        // by the same switch until the owner publishes it.
        where: { status: 'ACTIVE', published: true },
        orderBy: { displayOrder: 'asc' },
      });
      const categoryIds = categories.map((c) => c.id);
      const [names, shortDescriptions] = await Promise.all([
        this.getTranslationMap('CATEGORY', categoryIds),
        // Dizajn 17 — the one line under each card on /oglasi/novi. A field of
        // its own rather than `description`, which is the long copy the
        // /[categorySlug] page prints and uses as its meta description.
        this.getTranslationMap('CATEGORY', categoryIds, 'shortDescription'),
      ]);

      const byParent = new Map<string, typeof categories>();
      for (const cat of categories) {
        const key = cat.parentId ?? 'root';
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(cat);
      }

      const toNode = (cat: (typeof categories)[number]): CategoryNode => ({
        id: cat.id,
        slug: cat.slug,
        icon: cat.icon,
        name: names.get(cat.id) ?? cat.slug,
        shortDescription: shortDescriptions.get(cat.id) ?? null,
        children: (byParent.get(cat.id) ?? []).map(toNode),
      });

      return (byParent.get('root') ?? []).map(toNode);
    });
  }

  async getCategoryBySlug(slug: string) {
    // v2 (Dizajn 25): attribute options come in their displayOrder now, and the new key
    // keeps Redis from serving the old order after a deploy. v3 (Dizajn 50): the
    // category carries `published`, which its public page checks.
    return this.cache.getOrSet(`taxonomy:category:v3:${slug}`, CACHE_TTL, () => this.loadCategoryBySlug(slug));
  }

  private async loadCategoryBySlug(slug: string) {
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

    return { ...category, name: name ?? category.slug, description, attributes, children };
  }

  /**
   * ADR-010 / R2: walks the category up to its root, merging every ancestor's
   * attributes. A subcategory's own attributes are appended after (and can
   * share a display area with) its parent's — nothing is ever copied into the
   * child row, so editing a parent attribute reaches every descendant
   * instantly without a data migration.
   */
  async resolveAttributesForCategory(categoryId: string) {
    // v2 (Dizajn 25), like the category key above.
    return this.cache.getOrSet(`taxonomy:attributes:v2:${categoryId}`, CACHE_TTL, async () => {
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
        // Dizajn 25: options in the order the seed gives them, which is the frames' order.
        include: { options: { orderBy: { displayOrder: 'asc' } } },
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

  /** Same as getCategoryNames, for AttributeOption ids — e.g. resolving a LIST/CHECKBOX_GROUP key-fact value's display name. */
  async getOptionNames(optionIds: string[], language: Language = Language.SR): Promise<Map<string, string>> {
    return this.getTranslationMap('OPTION', optionIds, 'name', language);
  }

  // -- Admin ---------------------------------------------------------------

  /**
   * T129: every category with live counts. `listingCount` is every listing
   * the category holds except deleted ones (what a hide or delete would
   * touch), `activeListingCount` the ones visible in search. The
   * Category.listingCount column was never written and is not read.
   */
  async adminGetCategoryTree() {
    const [categories, all, active] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [{ level: 'asc' }, { displayOrder: 'asc' }] }),
      this.prisma.listing.groupBy({ by: ['categoryId'], where: { status: { not: 'DELETED' } }, _count: { _all: true } }),
      this.prisma.listing.groupBy({
        by: ['categoryId'],
        where: { status: 'ACTIVE', available: true },
        _count: { _all: true },
      }),
    ]);
    const allCounts = new Map(all.map((row) => [row.categoryId, row._count._all]));
    const activeCounts = new Map(active.map((row) => [row.categoryId, row._count._all]));
    const names = await this.getTranslationMap('CATEGORY', categories.map((c) => c.id));
    return categories.map((c) => ({
      ...c,
      name: names.get(c.id) ?? c.slug,
      listingCount: allCounts.get(c.id) ?? 0,
      activeListingCount: activeCounts.get(c.id) ?? 0,
    }));
  }

  /** T129: one category for its screen in Administracija > Kategorije, with its texts and live counts. */
  async adminGetCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    const [texts, listingCount, activeListingCount, childCount] = await Promise.all([
      this.getCategoryTexts(id),
      this.prisma.listing.count({ where: { categoryId: id, status: { not: 'DELETED' } } }),
      this.prisma.listing.count({ where: { categoryId: id, status: 'ACTIVE', available: true } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);
    return {
      ...category,
      name: texts.name ?? category.slug,
      description: texts.description ?? '',
      shortDescription: texts.shortDescription ?? '',
      listingCount,
      activeListingCount,
      childCount,
    };
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

  /**
   * T129: a new category starts as a draft (published false) unless the
   * admin publishes it straight away, and can start as a copy of another
   * one: its booking settings come from the form, its attributes, options
   * and search filters from the source.
   */
  async adminCreateCategory(adminId: string, dto: CreateCategoryDto) {
    const parentId = dto.parentId ?? null;
    const level = parentId ? await this.levelUnder(parentId) : 1;
    if (dto.copyFromId) {
      const source = await this.prisma.category.findUnique({ where: { id: dto.copyFromId } });
      if (!source) throw new NotFoundException();
    }
    const slug = dto.slug ? await this.assertSlugFree(dto.slug) : await this.uniqueSlug(dto.name);
    const lastSibling = await this.prisma.category.findFirst({
      where: { parentId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const category = await this.prisma.category.create({
      data: {
        parentId,
        level,
        slug,
        icon: dto.icon,
        status: 'ACTIVE',
        defaultBookingModel: dto.defaultBookingModel,
        allowedPriceUnits: dto.allowedPriceUnits,
        defaultPriceUnit: dto.defaultPriceUnit,
        displayOrder: dto.displayOrder ?? (lastSibling ? lastSibling.displayOrder + 1 : 0),
        published: dto.published ?? false,
      },
    });
    await this.setTranslation('CATEGORY', category.id, 'name', dto.name);
    await this.setOrClearCategoryText(category.id, 'description', dto.description);
    await this.setOrClearCategoryText(category.id, 'shortDescription', dto.shortDescription);
    // A slug that used to redirect belongs to this category now.
    await this.prisma.redirect.deleteMany({ where: { oldPath: `/${slug}` } });
    if (dto.copyFromId) await this.copyCategoryStructure(dto.copyFromId, category.id);
    await this.logChange(adminId, 'category.create', 'Category', category.id, undefined, {
      ...category,
      ...(await this.getCategoryTexts(category.id)),
      copiedFromId: dto.copyFromId,
    });
    await this.invalidateTreeCache();
    return category;
  }

  async adminUpdateCategory(adminId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    const before = { ...category, ...(await this.getCategoryTexts(id)) };

    const slug =
      dto.slug !== undefined && dto.slug !== category.slug
        ? await this.assertSlugFree(dto.slug, id)
        : undefined;
    const moving = dto.parentId !== undefined && dto.parentId !== category.parentId;
    const level = moving ? await this.levelForMove(category.id, dto.parentId ?? null) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: {
          slug,
          parentId: moving ? (dto.parentId ?? null) : undefined,
          level,
          icon: dto.icon,
          defaultBookingModel: dto.defaultBookingModel,
          allowedPriceUnits: dto.allowedPriceUnits,
          defaultPriceUnit: dto.defaultPriceUnit,
          displayOrder: dto.displayOrder,
          published: dto.published,
        },
      });
      if (level !== undefined) {
        await tx.category.updateMany({ where: { parentId: id }, data: { level: level + 1 } });
      }
      if (slug) {
        // Category pages live at /<slug>, whatever the parent, so only a new
        // slug moves a URL: the old one and every redirect that led to it
        // now lead to the new one, and the new one stops redirecting.
        const oldPath = `/${category.slug}`;
        const newPath = `/${slug}`;
        await tx.redirect.deleteMany({ where: { oldPath: newPath } });
        await tx.redirect.updateMany({ where: { newPath: oldPath }, data: { newPath } });
        await tx.redirect.upsert({
          where: { oldPath },
          update: { newPath, type: 301 },
          create: { oldPath, newPath, type: 301 },
        });
      }
    });
    if (dto.name) await this.setTranslation('CATEGORY', id, 'name', dto.name);
    await this.setOrClearCategoryText(id, 'description', dto.description);
    await this.setOrClearCategoryText(id, 'shortDescription', dto.shortDescription);
    const updated = await this.prisma.category.findUniqueOrThrow({ where: { id } });
    await this.logChange(adminId, 'category.update', 'Category', id, before, {
      ...updated,
      ...(await this.getCategoryTexts(id)),
    });
    await this.invalidateTreeCache(id);
    return updated;
  }

  /** T129: the order of one level of the tree, as the admin dragged it. */
  async adminReorderCategories(adminId: string, dto: ReorderCategoriesDto) {
    const parentId = dto.parentId ?? null;
    const siblings = await this.prisma.category.findMany({
      where: { parentId },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, displayOrder: true },
    });
    const siblingIds = new Set(siblings.map((sibling) => sibling.id));
    if (dto.ids.length !== siblings.length || new Set(dto.ids).size !== dto.ids.length || dto.ids.some((id) => !siblingIds.has(id))) {
      throw new BadRequestException(this.i18n.t('errors.CATEGORY_REORDER_INVALID'));
    }
    await this.prisma.$transaction(
      dto.ids.map((id, index) => this.prisma.category.update({ where: { id }, data: { displayOrder: index } })),
    );
    await this.logChange(
      adminId,
      'category.reorder',
      'Category',
      parentId ?? 'root',
      siblings.map((sibling) => sibling.id),
      dto.ids,
    );
    await this.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** T129: the category picture, replaced by every upload. */
  async adminSetCategoryImage(adminId: string, id: string, file: Express.Multer.File) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    if (!file) throw new BadRequestException(this.i18n.t('errors.IMAGE_INVALID'));
    const { url } = await this.uploads.saveImage(file, 'categories', { maxWidth: 1600 });
    const updated = await this.prisma.category.update({ where: { id }, data: { imageUrl: url } });
    await this.logChange(adminId, 'category.image', 'Category', id, { imageUrl: category.imageUrl }, { imageUrl: url });
    await this.invalidateTreeCache(id);
    return updated;
  }

  async adminRemoveCategoryImage(adminId: string, id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    const updated = await this.prisma.category.update({ where: { id }, data: { imageUrl: null } });
    await this.logChange(adminId, 'category.image', 'Category', id, { imageUrl: category.imageUrl }, { imageUrl: null });
    await this.invalidateTreeCache(id);
    return updated;
  }

  /**
   * T129: the change history of one category: its own rows, the order of
   * its level, and its attributes (deleted ones included, found by the
   * categoryId the row kept).
   */
  async adminCategoryHistory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { parentId: true } });
    if (!category) throw new NotFoundException();
    return this.prisma.adminLog.findMany({
      where: {
        OR: [
          { entityType: 'Category', entityId: id },
          { action: 'category.reorder', entityId: category.parentId ?? 'root' },
          {
            entityType: 'CategoryAttribute',
            OR: [
              { oldValue: { path: ['categoryId'], equals: id } },
              { newValue: { path: ['categoryId'], equals: id } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  /**
   * T129: the target of a stored redirect (a merge, a new slug), for the
   * category pages. Every category page asks, so "none" is an answer
   * (newPath null), not a 404 in each visitor's console.
   */
  async resolveRedirect(path: string) {
    const redirect = path ? await this.prisma.redirect.findUnique({ where: { oldPath: path } }) : null;
    if (!redirect || redirect.newPath === path) return { newPath: null, type: null };
    return { newPath: redirect.newPath, type: redirect.type };
  }

  async adminApproveCategory(adminId: string, id: string) {
    const category = await this.prisma.category.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.logChange(adminId, 'category.approve', 'Category', id, undefined, { status: 'ACTIVE' });
    await this.invalidateTreeCache();
    if (category.proposedByUserId) {
      this.events.emit('taxonomy.category_approved', { categoryId: id, userId: category.proposedByUserId });
    }
    return category;
  }

  /** R6: rejected proposals' listings fall back to the hidden "Ostalo" parent. */
  async adminRejectCategory(adminId: string, id: string, dto: RejectCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    const fallback = await this.prisma.category.findUniqueOrThrow({ where: { slug: FALLBACK_CATEGORY_SLUG } });

    await this.prisma.$transaction([
      this.prisma.listing.updateMany({ where: { categoryId: id }, data: { categoryId: fallback.id } }),
      this.prisma.category.update({ where: { id }, data: { status: 'ARCHIVED' } }),
    ]);
    await this.logChange(adminId, 'category.reject', 'Category', id, { status: category.status }, {
      status: 'ARCHIVED',
      reason: dto.reason,
    });
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
  async adminMergeCategory(adminId: string, id: string, dto: MergeCategoryDto) {
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
    await this.logChange(adminId, 'category.merge', 'Category', id, { status: source.status }, {
      status: 'MERGED',
      mergedIntoId: target.id,
    });
    await this.invalidateTreeCache();

    for (const owner of affectedListingOwners) {
      this.events.emit('taxonomy.category_merged', { userId: owner.userId, fromSlug: source.slug, toSlug: target.slug });
    }
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** R8: promoting a subcategory to a main category. */
  async adminPromoteCategory(adminId: string, id: string) {
    // T129: a move to the top, with the subtree levels and the history the
    // move keeps. The URL is /<slug> at any level, so nothing redirects (the
    // redirect this used to write pointed a URL at itself).
    await this.adminUpdateCategory(adminId, id, { parentId: null });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /**
   * Hard delete — only ever safe for an empty category (no listings, no
   * subcategories still pointing at it): with either present, deleting it
   * out from under them would silently orphan real data, so this blocks
   * instead and points the admin at merge (moves listings elsewhere) or
   * reject (archives + reassigns to the "Ostalo" fallback) as the ways to
   * clear it first.
   */
  async adminDeleteCategory(adminId: string, id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    if (category.slug === FALLBACK_CATEGORY_SLUG) {
      throw new BadRequestException(this.i18n.t('errors.CATEGORY_IS_FALLBACK'));
    }

    const childCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException({
        message: this.i18n.t('errors.CATEGORY_HAS_CHILDREN'),
        code: 'CATEGORY_HAS_CHILDREN',
        childCount,
      });
    }

    // T129: the page offers "Sakrij" on this code. Deleted listings still
    // point at the category, so they block the delete too.
    const listingCount = await this.prisma.listing.count({ where: { categoryId: id } });
    if (listingCount > 0) {
      throw new BadRequestException({
        message: this.i18n.t('errors.CATEGORY_HAS_LISTINGS', { args: { count: listingCount } }),
        code: 'CATEGORY_HAS_LISTINGS',
        listingCount,
      });
    }

    // EmptySearch.categoryId is an optional analytics pointer with no DB
    // cascade — clear it rather than losing the search log to an FK error.
    await this.prisma.emptySearch.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await this.prisma.categoryAttribute.deleteMany({ where: { categoryId: id } }); // cascades AttributeOption
    await this.prisma.category.delete({ where: { id } });
    await this.logChange(adminId, 'category.delete', 'Category', id, {
      ...category,
      ...(await this.getCategoryTexts(id)),
    });
    await this.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Admin: attributes -----------------------------------------------

  async adminUpsertAttribute(adminId: string, categoryId: string, dto: UpsertAttributeDto) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException();
    const before = await this.prisma.categoryAttribute.findUnique({
      where: { categoryId_key: { categoryId, key: dto.key } },
    });

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

    await this.logChange(
      adminId,
      before ? 'attribute.update' : 'attribute.create',
      'CategoryAttribute',
      attribute.id,
      before ?? undefined,
      { ...attribute, name: dto.name, options: dto.options },
    );
    await this.invalidateTreeCache(categoryId);
    return attribute;
  }

  async adminDeleteAttribute(adminId: string, attributeId: string) {
    const usageCount = await this.prisma.listingAttribute.count({ where: { attributeId } });
    if (usageCount > 0) {
      throw new BadRequestException(
        `${usageCount} listing(s) use this attribute — remove it from the category form instead of deleting`,
      );
    }
    const attribute = await this.prisma.categoryAttribute.delete({ where: { id: attributeId } });
    await this.logChange(adminId, 'attribute.delete', 'CategoryAttribute', attributeId, attribute);
    await this.invalidateTreeCache(attribute.categoryId);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Internal helpers ------------------------------------------------

  /** T129: an empty string clears a text; undefined leaves it alone. */
  private async setOrClearCategoryText(id: string, field: string, value: string | undefined) {
    if (value === undefined) return;
    const trimmed = value.trim();
    if (trimmed) {
      await this.setTranslation('CATEGORY', id, field, trimmed);
    } else {
      await this.prisma.translation.deleteMany({ where: { entityType: 'CATEGORY', entityId: id, field } });
    }
  }

  /** T129: a valid slug no other category, and no other category's old URL, holds. */
  private async assertSlugFree(raw: string, ownId?: string): Promise<string> {
    const slug = raw.trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) throw new BadRequestException(this.i18n.t('errors.CATEGORY_SLUG_INVALID'));
    const holder = await this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (holder && holder.id !== ownId) throw new BadRequestException(this.i18n.t('errors.CATEGORY_SLUG_TAKEN'));
    return slug;
  }

  /** The level a new child of parentId gets. */
  private async levelUnder(parentId: string): Promise<number> {
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException();
    if (parent.level >= 3) throw new BadRequestException(this.i18n.t('errors.CATEGORY_MAX_DEPTH'));
    return parent.level + 1;
  }

  /** The level of a category moved under parentId (null: a main one), its subtree kept within three levels. */
  private async levelForMove(id: string, parentId: string | null): Promise<number> {
    const descendants = await this.descendantIds(id);
    if (parentId && (parentId === id || descendants.depth.has(parentId))) {
      throw new BadRequestException(this.i18n.t('errors.CATEGORY_PARENT_INVALID'));
    }
    const level = parentId ? await this.levelUnder(parentId) : 1;
    const deepest = Math.max(0, ...descendants.depth.values());
    if (level + deepest > 3) throw new BadRequestException(this.i18n.t('errors.CATEGORY_MAX_DEPTH'));
    return level;
  }

  /** Every category below id, with how many levels below it sits. */
  private async descendantIds(id: string): Promise<{ depth: Map<string, number> }> {
    const depth = new Map<string, number>();
    let frontier = [id];
    for (let level = 1; frontier.length && level <= 3; level += 1) {
      const children = await this.prisma.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
      for (const child of children) depth.set(child.id, level);
      frontier = children.map((child) => child.id);
    }
    return { depth };
  }

  /** T129 "Kopiraj iz postojeće kategorije": the source's own attributes, options and filters, with their names. */
  private async copyCategoryStructure(sourceId: string, targetId: string) {
    const [attributes, filters] = await Promise.all([
      this.prisma.categoryAttribute.findMany({
        where: { categoryId: sourceId },
        include: { options: true },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.categoryFilter.findMany({ where: { categoryId: sourceId } }),
    ]);
    const translations = await this.prisma.translation.findMany({
      where: {
        OR: [
          { entityType: 'ATTRIBUTE', entityId: { in: attributes.map((attribute) => attribute.id) } },
          { entityType: 'OPTION', entityId: { in: attributes.flatMap((attribute) => attribute.options.map((option) => option.id)) } },
        ],
      },
    });
    const copyTexts = async (entityType: 'ATTRIBUTE' | 'OPTION', fromId: string, toId: string) => {
      const rows = translations.filter((row) => row.entityType === entityType && row.entityId === fromId);
      if (rows.length) {
        await this.prisma.translation.createMany({
          data: rows.map(({ field, language, value }) => ({ entityType, entityId: toId, field, language, value })),
        });
      }
    };

    for (const { id: _id, categoryId: _categoryId, options, ...fields } of attributes) {
      const copy = await this.prisma.categoryAttribute.create({ data: { ...fields, categoryId: targetId } });
      await copyTexts('ATTRIBUTE', _id, copy.id);
      for (const { id: optionId, attributeId: _attributeId, ...optionFields } of options) {
        const optionCopy = await this.prisma.attributeOption.create({ data: { ...optionFields, attributeId: copy.id } });
        await copyTexts('OPTION', optionId, optionCopy.id);
      }
    }
    if (filters.length) {
      await this.prisma.categoryFilter.createMany({
        data: filters.map(({ id: _id, categoryId: _categoryId, ...fields }) => ({ ...fields, categoryId: targetId })),
      });
    }
  }


  /**
   * T129: the panel's change history. The same AdminLog rows the admin
   * module writes (AdminService.logAction), so Administracija shows one
   * history for every admin action.
   */
  private async logChange(
    adminId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.adminLog.create({
      data: {
        userId: adminId,
        action,
        entityType,
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: newValue === undefined ? undefined : JSON.parse(JSON.stringify(newValue)),
      },
    });
  }

  /** The translated texts of a category, for the history's before and after. */
  private async getCategoryTexts(id: string) {
    const rows = await this.prisma.translation.findMany({
      where: { entityType: 'CATEGORY', entityId: id, language: Language.SR },
    });
    return Object.fromEntries(rows.map((row) => [row.field, row.value]));
  }

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
    // The counts go too: a merge or a rejection moves listings to another category.
    await this.cache.del(TREE_CACHE_KEY, LISTING_COUNTS_CACHE_KEY);
    await this.cache.delByPrefix('taxonomy:category:');
    await this.cache.delByPrefix('taxonomy:attributes:');
    await this.cache.delByPrefix(SEARCH_FILTERS_CACHE_PREFIX);
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
