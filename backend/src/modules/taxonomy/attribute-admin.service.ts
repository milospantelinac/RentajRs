import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { AttributeType, CategoryFilter, FilterControl, FilterPlacement, Language, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GUEST_CAPACITY_ATTRIBUTE_KEYS } from '../../common/utils/guest-capacity';
import { TaxonomyService, slugify } from './taxonomy.service';
import {
  CreateAttributeDto,
  CreateFilterDto,
  CreateOptionDto,
  ReorderIdsDto,
  SetFactKeysDto,
  UpdateAttributeDto,
  UpdateFilterDto,
  UpdateOptionDto,
} from './dto/attribute-admin.dto';

/**
 * T129: fields the code reads by key, the guest caps (bookings, search, the
 * booking widgets) and Igraonice's age range. They can be renamed and
 * reordered, never deleted, hidden or given another type.
 */
export const SYSTEM_ATTRIBUTE_KEYS = [...GUEST_CAPACITY_ATTRIBUTE_KEYS, 'uzrast_dece'];

/** The types whose value is a pick from the attribute's options. */
const LIST_TYPES: AttributeType[] = [AttributeType.LIST, AttributeType.MULTISELECT, AttributeType.CHECKBOX_GROUP];

/** Which filter reads which field type (SearchService.describeFilters, frontend utils/searchFilters.js). */
export const FILTER_CONTROLS_BY_TYPE: Record<AttributeType, FilterControl[]> = {
  NUMBER: [FilterControl.RANGE, FilterControl.MIN],
  YEAR: [FilterControl.RANGE],
  LIST: [FilterControl.SELECT, FilterControl.MULTI_SELECT, FilterControl.MIN],
  MULTISELECT: [FilterControl.MULTI_SELECT, FilterControl.ALL_OF, FilterControl.OPTION_TOGGLE],
  CHECKBOX_GROUP: [FilterControl.MULTI_SELECT, FilterControl.ALL_OF, FilterControl.OPTION_TOGGLE],
  BOOLEAN: [FilterControl.TOGGLE],
  TEXT: [],
  TEXTAREA: [],
};

/** What /pretraga draws where: the pills of the bar and the "Više filtera" panel. */
export const FILTER_CONTROLS_BY_PLACEMENT: Record<FilterPlacement, FilterControl[]> = {
  BAR: [
    FilterControl.GUESTS,
    FilterControl.AREA,
    FilterControl.SELECT,
    FilterControl.MIN,
    FilterControl.MULTI_SELECT,
    FilterControl.TOGGLE,
    FilterControl.OPTION_TOGGLE,
  ],
  PANEL: [
    FilterControl.RANGE,
    FilterControl.SELECT,
    FilterControl.MIN,
    FilterControl.MULTI_SELECT,
    FilterControl.ALL_OF,
    FilterControl.TOGGLE,
    FilterControl.OPTION_TOGGLE,
  ],
};

type PoolEntry = {
  key: string;
  name: string;
  type: AttributeType;
  hidden: boolean;
  options: Array<{ key: string; name: string; hidden: boolean }>;
};

/**
 * T129 part 2: the fields and amenities of a category (CategoryAttribute and
 * AttributeOption), its search filters (CategoryFilter) and its key facts,
 * as Administracija > Kategorije edits them. A key is made once from the
 * name and never changes, since filters, conditions and code find fields
 * and items by it; the name is what the admin renames.
 */
@Injectable()
export class AttributeAdminService {
  constructor(
    private prisma: PrismaService,
    private taxonomy: TaxonomyService,
    private i18n: I18nService,
  ) {}

  // -- Fields and amenities ---------------------------------------------

  /** The category's own fields and the ones it inherits, with usage counts, its key facts and their choices. */
  async listAttributes(categoryId: string) {
    const category = await this.getCategory(categoryId);
    const chain = await this.ancestorChain(categoryId);
    const below = await this.descendantIds(categoryId);
    const attributes = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: { in: [...chain, ...below] } },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
    const inChain = attributes
      .filter((attribute) => chain.includes(attribute.categoryId))
      .sort((a, b) => chain.indexOf(a.categoryId) - chain.indexOf(b.categoryId) || a.displayOrder - b.displayOrder);
    const ids = inChain.map((attribute) => attribute.id);
    const [attributeNames, optionNames, categoryNames, attributeUsage, optionUsage, facts] = await Promise.all([
      this.taxonomy.getTranslationMap('ATTRIBUTE', attributes.map((attribute) => attribute.id)),
      this.taxonomy.getTranslationMap('OPTION', attributes.flatMap((attribute) => attribute.options.map((o) => o.id))),
      this.taxonomy.getTranslationMap('CATEGORY', [...chain, ...below]),
      this.attributeUsage(ids),
      this.optionUsage(ids),
      this.taxonomy.getFactKeys(categoryId),
    ]);
    // Conditions point at a key, across the whole tree the category reads.
    const dependents = (key: string, optionKey?: string) =>
      attributes.filter(
        (attribute) => attribute.dependsOnAttrKey === key && (optionKey === undefined || attribute.dependsOnOptionKey === optionKey),
      ).length;

    return {
      attributes: inChain.map((attribute) => ({
        id: attribute.id,
        categoryId: attribute.categoryId,
        categoryName: categoryNames.get(attribute.categoryId) ?? null,
        inherited: attribute.categoryId !== categoryId,
        key: attribute.key,
        name: attributeNames.get(attribute.id) ?? attribute.key,
        type: attribute.type,
        unit: attribute.unit,
        required: attribute.required,
        showOnListing: attribute.showOnListing,
        hidden: attribute.hidden,
        icon: attribute.icon,
        dependsOnAttrKey: attribute.dependsOnAttrKey,
        dependsOnOptionKey: attribute.dependsOnOptionKey,
        displayOrder: attribute.displayOrder,
        system: SYSTEM_ATTRIBUTE_KEYS.includes(attribute.key),
        listingCount: attributeUsage.get(attribute.id) ?? 0,
        dependentCount: dependents(attribute.key),
        options: attribute.options.map((option) => ({
          id: option.id,
          key: option.key,
          name: optionNames.get(option.id) ?? option.key,
          hidden: option.hidden,
          icon: option.icon,
          displayOrder: option.displayOrder,
          listingCount: optionUsage.get(option.id) ?? 0,
          dependentCount: dependents(attribute.key, option.key),
        })),
      })),
      cardFactKeys: category.cardFactKeys,
      listingFactKeys: category.listingFactKeys,
      // What applies while the category has none of its own (the parent's).
      resolvedCardFactKeys: facts.cardFactKeys,
      resolvedListingFactKeys: facts.listingFactKeys,
      factPool: this.factPool(attributes, attributeNames),
    };
  }

  async createAttribute(adminId: string, categoryId: string, dto: CreateAttributeDto) {
    await this.getCategory(categoryId);
    const name = dto.name.trim();
    const key = await this.freeAttributeKey(categoryId, name);
    const condition = await this.validateCondition(categoryId, dto.dependsOnAttrKey, dto.dependsOnOptionKey);
    const last = await this.prisma.categoryAttribute.findFirst({
      where: { categoryId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const options = LIST_TYPES.includes(dto.type) ? (dto.options ?? []) : [];

    const attribute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.categoryAttribute.create({
        data: {
          categoryId,
          key,
          type: dto.type,
          required: dto.required ?? false,
          unit: dto.unit?.trim() || null,
          showOnListing: dto.showOnListing ?? true,
          icon: dto.icon || null,
          ...condition,
          displayOrder: last ? last.displayOrder + 1 : 0,
        },
      });
      await this.writeName(tx, 'ATTRIBUTE', created.id, name);
      const taken = new Set<string>();
      for (const [index, option] of options.entries()) {
        const optionKey = this.freeOptionKey(taken, option.name);
        taken.add(optionKey);
        const row = await tx.attributeOption.create({
          data: { attributeId: created.id, key: optionKey, icon: option.icon || null, displayOrder: index },
        });
        await this.writeName(tx, 'OPTION', row.id, option.name.trim());
      }
      return created;
    });

    await this.taxonomy.logChange(adminId, 'attribute.create', 'CategoryAttribute', attribute.id, undefined, {
      ...attribute,
      name,
      options: options.map((option) => option.name.trim()),
    });
    await this.taxonomy.invalidateTreeCache();
    return attribute;
  }

  async updateAttribute(adminId: string, attributeId: string, dto: UpdateAttributeDto) {
    const attribute = await this.getAttribute(attributeId);
    const names = await this.taxonomy.getTranslationMap('ATTRIBUTE', [attribute.id]);
    // The items have their own history rows; an edit of the field leaves them out.
    const { options: _options, ...fields } = attribute;
    const before = { ...fields, name: names.get(attribute.id) ?? attribute.key };
    const system = SYSTEM_ATTRIBUTE_KEYS.includes(attribute.key);

    const typeChange = dto.type !== undefined && dto.type !== attribute.type;
    if (typeChange) {
      if (system) throw this.refusal('ATTRIBUTE_SYSTEM');
      const listingCount = (await this.attributeUsage([attribute.id])).get(attribute.id) ?? 0;
      if (listingCount) throw this.refusal('ATTRIBUTE_TYPE_LOCKED', { listingCount });
      const dependentCount = await this.dependentCount(attribute.categoryId, attribute.key);
      if (dependentCount && dto.type !== AttributeType.LIST) throw this.refusal('ATTRIBUTE_HAS_DEPENDENTS', { dependentCount });
    }
    if (dto.hidden === true && system) throw this.refusal('ATTRIBUTE_SYSTEM');
    const conditionGiven = dto.dependsOnAttrKey !== undefined || dto.dependsOnOptionKey !== undefined;
    const condition = conditionGiven
      ? await this.validateCondition(attribute.categoryId, dto.dependsOnAttrKey, dto.dependsOnOptionKey, attribute.key)
      : {};

    const updated = await this.prisma.$transaction(async (tx) => {
      // A field that stops being a list drops its items; nothing uses them (no listing has a value).
      if (typeChange && !LIST_TYPES.includes(dto.type!) && attribute.options.length) {
        const optionIds = attribute.options.map((option) => option.id);
        await tx.translation.deleteMany({ where: { entityType: 'OPTION', entityId: { in: optionIds } } });
        await tx.attributeOption.deleteMany({ where: { id: { in: optionIds } } });
      }
      const row = await tx.categoryAttribute.update({
        where: { id: attribute.id },
        data: {
          type: dto.type,
          unit: dto.unit === undefined ? undefined : dto.unit.trim() || null,
          required: dto.required,
          showOnListing: dto.showOnListing,
          hidden: dto.hidden,
          icon: dto.icon === undefined ? undefined : dto.icon || null,
          ...condition,
        },
      });
      if (dto.name) await this.writeName(tx, 'ATTRIBUTE', attribute.id, dto.name.trim());
      return row;
    });

    await this.taxonomy.logChange(adminId, 'attribute.update', 'CategoryAttribute', attribute.id, before, {
      ...updated,
      name: dto.name?.trim() ?? before.name,
    });
    await this.taxonomy.invalidateTreeCache();
    return updated;
  }

  /** Never blind: a field in use is hidden instead, and one others depend on keeps them working. */
  async deleteAttribute(adminId: string, attributeId: string) {
    const attribute = await this.getAttribute(attributeId);
    if (SYSTEM_ATTRIBUTE_KEYS.includes(attribute.key)) throw this.refusal('ATTRIBUTE_SYSTEM');
    const listingCount = (await this.attributeUsage([attribute.id])).get(attribute.id) ?? 0;
    if (listingCount) throw this.refusal('ATTRIBUTE_IN_USE', { listingCount });
    const dependentCount = await this.dependentCount(attribute.categoryId, attribute.key);
    if (dependentCount) throw this.refusal('ATTRIBUTE_HAS_DEPENDENTS', { dependentCount });

    const names = await this.taxonomy.getTranslationMap('ATTRIBUTE', [attribute.id]);
    const optionIds = attribute.options.map((option) => option.id);
    await this.prisma.$transaction(async (tx) => {
      // Only deleted listings can still hold a value; the foreign key would refuse the delete.
      await tx.listingAttribute.deleteMany({ where: { attributeId: attribute.id } });
      await tx.translation.deleteMany({
        where: {
          OR: [
            { entityType: 'ATTRIBUTE', entityId: attribute.id },
            { entityType: 'OPTION', entityId: { in: optionIds } },
          ],
        },
      });
      await tx.categoryAttribute.delete({ where: { id: attribute.id } });
    });

    await this.taxonomy.logChange(adminId, 'attribute.delete', 'CategoryAttribute', attribute.id, {
      ...attribute,
      name: names.get(attribute.id) ?? attribute.key,
      options: attribute.options.map((option) => option.key),
    });
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** The order of the category's own fields (inherited ones keep the parent's). */
  async reorderAttributes(adminId: string, categoryId: string, dto: ReorderIdsDto) {
    await this.getCategory(categoryId);
    const own = await this.prisma.categoryAttribute.findMany({
      where: { categoryId },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, key: true },
    });
    this.assertSameSet(
      own.map((attribute) => attribute.id),
      dto.ids,
    );
    await this.prisma.$transaction(
      dto.ids.map((id, index) => this.prisma.categoryAttribute.update({ where: { id }, data: { displayOrder: index } })),
    );
    const keyOf = new Map(own.map((attribute) => [attribute.id, attribute.key]));
    await this.taxonomy.logChange(
      adminId,
      'attribute.reorder',
      'CategoryAttribute',
      categoryId,
      { categoryId, order: own.map((attribute) => attribute.key) },
      { categoryId, order: dto.ids.map((id) => keyOf.get(id)) },
    );
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async createOption(adminId: string, attributeId: string, dto: CreateOptionDto) {
    const attribute = await this.getAttribute(attributeId);
    if (!LIST_TYPES.includes(attribute.type)) throw this.refusal('ATTRIBUTE_TYPE_NO_OPTIONS');
    const name = dto.name.trim();
    const key = this.freeOptionKey(new Set(attribute.options.map((option) => option.key)), name);
    const last = attribute.options.reduce((max, option) => Math.max(max, option.displayOrder), -1);
    const option = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attributeOption.create({
        data: { attributeId: attribute.id, key, icon: dto.icon || null, displayOrder: last + 1 },
      });
      await this.writeName(tx, 'OPTION', row.id, name);
      return row;
    });
    await this.taxonomy.logChange(adminId, 'option.create', 'AttributeOption', option.id, undefined, {
      ...option,
      name,
      categoryId: attribute.categoryId,
      attributeKey: attribute.key,
    });
    await this.taxonomy.invalidateTreeCache();
    return option;
  }

  async updateOption(adminId: string, optionId: string, dto: UpdateOptionDto) {
    const option = await this.getOption(optionId);
    const names = await this.taxonomy.getTranslationMap('OPTION', [option.id]);
    const context = { categoryId: option.attribute.categoryId, attributeKey: option.attribute.key };
    const { attribute: _attribute, ...row } = option;
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.attributeOption.update({
        where: { id: option.id },
        data: { hidden: dto.hidden, icon: dto.icon === undefined ? undefined : dto.icon || null },
      });
      if (dto.name) await this.writeName(tx, 'OPTION', option.id, dto.name.trim());
      return saved;
    });
    await this.taxonomy.logChange(
      adminId,
      'option.update',
      'AttributeOption',
      option.id,
      { ...row, name: names.get(option.id) ?? option.key, ...context },
      { ...updated, name: dto.name?.trim() ?? names.get(option.id) ?? option.key, ...context },
    );
    await this.taxonomy.invalidateTreeCache();
    return updated;
  }

  async deleteOption(adminId: string, optionId: string) {
    const option = await this.getOption(optionId);
    const listingCount = (await this.optionUsage([option.attributeId])).get(option.id) ?? 0;
    if (listingCount) throw this.refusal('OPTION_IN_USE', { listingCount });
    const dependentCount = await this.dependentCount(option.attribute.categoryId, option.attribute.key, option.key);
    if (dependentCount) throw this.refusal('OPTION_HAS_DEPENDENTS', { dependentCount });

    const names = await this.taxonomy.getTranslationMap('OPTION', [option.id]);
    await this.prisma.$transaction(async (tx) => {
      // Only deleted listings can still hold it: drop the id, and a value left empty.
      await tx.$executeRaw`UPDATE "ListingAttribute" SET "valueOptionIds" = array_remove("valueOptionIds", ${option.id}::uuid) WHERE "attributeId" = ${option.attributeId}::uuid`;
      await tx.listingAttribute.deleteMany({
        where: { attributeId: option.attributeId, valueOptionIds: { isEmpty: true }, listing: { status: 'DELETED' } },
      });
      await tx.translation.deleteMany({ where: { entityType: 'OPTION', entityId: option.id } });
      await tx.attributeOption.delete({ where: { id: option.id } });
    });
    await this.taxonomy.logChange(adminId, 'option.delete', 'AttributeOption', option.id, {
      key: option.key,
      name: names.get(option.id) ?? option.key,
      categoryId: option.attribute.categoryId,
      attributeKey: option.attribute.key,
    });
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async reorderOptions(adminId: string, attributeId: string, dto: ReorderIdsDto) {
    const attribute = await this.getAttribute(attributeId);
    this.assertSameSet(
      attribute.options.map((option) => option.id),
      dto.ids,
    );
    await this.prisma.$transaction(
      dto.ids.map((id, index) => this.prisma.attributeOption.update({ where: { id }, data: { displayOrder: index } })),
    );
    const keyOf = new Map(attribute.options.map((option) => [option.id, option.key]));
    await this.taxonomy.logChange(
      adminId,
      'option.reorder',
      'AttributeOption',
      attribute.id,
      { categoryId: attribute.categoryId, attributeKey: attribute.key, order: attribute.options.map((option) => option.key) },
      { categoryId: attribute.categoryId, attributeKey: attribute.key, order: dto.ids.map((id) => keyOf.get(id)) },
    );
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Key facts ----------------------------------------------------------

  /** The card's (up to 3) and the listing page's (up to 6) key facts; an empty list falls back to the parent's. */
  async setFactKeys(adminId: string, categoryId: string, dto: SetFactKeysDto) {
    const category = await this.getCategory(categoryId);
    const chain = await this.ancestorChain(categoryId);
    const below = await this.descendantIds(categoryId);
    const attributes = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: { in: [...chain, ...below] } },
      include: { options: true },
    });
    const pool = new Set(this.factPool(attributes, new Map()).map((entry) => entry.key));
    for (const keys of [dto.cardFactKeys, dto.listingFactKeys]) {
      if (keys && (new Set(keys).size !== keys.length || keys.some((key) => !pool.has(key)))) {
        throw this.refusal('FACTS_INVALID');
      }
    }
    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: { cardFactKeys: dto.cardFactKeys, listingFactKeys: dto.listingFactKeys },
    });
    await this.taxonomy.logChange(
      adminId,
      'category.facts',
      'Category',
      categoryId,
      { cardFactKeys: category.cardFactKeys, listingFactKeys: category.listingFactKeys },
      { cardFactKeys: updated.cardFactKeys, listingFactKeys: updated.listingFactKeys },
    );
    await this.taxonomy.invalidateTreeCache(categoryId);
    return { cardFactKeys: updated.cardFactKeys, listingFactKeys: updated.listingFactKeys };
  }

  // -- Search filters -----------------------------------------------------

  /** The category's /pretraga filters, the fields they can read and the kinds each allows. */
  async listFilters(categoryId: string) {
    await this.getCategory(categoryId);
    const [rows, pool] = await Promise.all([
      this.prisma.categoryFilter.findMany({ where: { categoryId }, orderBy: { displayOrder: 'asc' } }),
      this.filterPool(categoryId),
    ]);
    return {
      filters: rows.map((row) => {
        const entry = row.attributeKey ? pool.get(row.attributeKey) : undefined;
        const option = row.optionKey ? entry?.options.find((candidate) => candidate.key === row.optionKey) : undefined;
        return {
          ...row,
          name: row.control === FilterControl.OPTION_TOGGLE ? (option?.name ?? null) : (entry?.name ?? null),
          // A field or item gone from the category: search leaves the filter out (describeFilters).
          missing:
            row.control !== FilterControl.AREA &&
            (!entry || (row.control === FilterControl.OPTION_TOGGLE && !option)),
        };
      }),
      pool: [...pool.values()],
      controlsByType: FILTER_CONTROLS_BY_TYPE,
      controlsByPlacement: FILTER_CONTROLS_BY_PLACEMENT,
      guestKeys: GUEST_CAPACITY_ATTRIBUTE_KEYS,
    };
  }

  async createFilter(adminId: string, categoryId: string, dto: CreateFilterDto) {
    await this.getCategory(categoryId);
    const pool = await this.filterPool(categoryId);
    const filter = this.validateFilter(pool, dto);
    const rows = await this.prisma.categoryFilter.findMany({ where: { categoryId } });
    const duplicate = rows.some((row) =>
      filter.control === FilterControl.AREA || filter.control === FilterControl.GUESTS
        ? row.control === filter.control
        : row.attributeKey === filter.attributeKey && row.optionKey === filter.optionKey,
    );
    if (duplicate) throw this.refusal('FILTER_DUPLICATE');

    const base =
      filter.control === FilterControl.AREA
        ? 'area'
        : filter.control === FilterControl.GUESTS
          ? 'guests'
          : filter.optionKey
            ? `${filter.attributeKey}_${filter.optionKey}`
            : filter.attributeKey!;
    const taken = new Set(rows.map((row) => row.key));
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;

    const created = await this.prisma.categoryFilter.create({
      data: {
        categoryId,
        key,
        ...filter,
        displayOrder: rows.reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1,
      },
    });
    await this.taxonomy.logChange(adminId, 'filter.create', 'CategoryFilter', created.id, undefined, created);
    await this.taxonomy.invalidateTreeCache();
    return created;
  }

  async updateFilter(adminId: string, filterId: string, dto: UpdateFilterDto) {
    const row = await this.getFilter(filterId);
    const pool = await this.filterPool(row.categoryId);
    const filter = this.validateFilter(pool, {
      control: dto.control ?? row.control,
      placement: dto.placement ?? row.placement,
      attributeKey: row.attributeKey ?? undefined,
      optionKey: row.optionKey ?? undefined,
      thresholds: dto.thresholds ?? row.thresholds,
    });
    const updated = await this.prisma.categoryFilter.update({ where: { id: row.id }, data: filter });
    await this.taxonomy.logChange(adminId, 'filter.update', 'CategoryFilter', row.id, row, updated);
    await this.taxonomy.invalidateTreeCache();
    return updated;
  }

  async deleteFilter(adminId: string, filterId: string) {
    const row = await this.getFilter(filterId);
    await this.prisma.categoryFilter.delete({ where: { id: row.id } });
    await this.taxonomy.logChange(adminId, 'filter.delete', 'CategoryFilter', row.id, row);
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async reorderFilters(adminId: string, categoryId: string, dto: ReorderIdsDto) {
    await this.getCategory(categoryId);
    const rows = await this.prisma.categoryFilter.findMany({ where: { categoryId }, orderBy: { displayOrder: 'asc' } });
    this.assertSameSet(
      rows.map((row) => row.id),
      dto.ids,
    );
    await this.prisma.$transaction(
      dto.ids.map((id, index) => this.prisma.categoryFilter.update({ where: { id }, data: { displayOrder: index } })),
    );
    const keyOf = new Map(rows.map((row) => [row.id, row.key]));
    await this.taxonomy.logChange(
      adminId,
      'filter.reorder',
      'CategoryFilter',
      categoryId,
      { categoryId, order: rows.map((row) => row.key) },
      { categoryId, order: dto.ids.map((id) => keyOf.get(id)) },
    );
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Internal -------------------------------------------------------------

  /** Normalises a filter, refusing a kind the field or the place can't show (what /pretraga can draw). */
  private validateFilter(
    pool: Map<string, PoolEntry>,
    input: { control: FilterControl; placement: FilterPlacement; attributeKey?: string; optionKey?: string; thresholds?: number[] },
  ): Pick<CategoryFilter, 'control' | 'placement' | 'attributeKey' | 'optionKey' | 'thresholds'> {
    const { control, placement } = input;
    if (!FILTER_CONTROLS_BY_PLACEMENT[placement].includes(control)) throw this.refusal('FILTER_INVALID');
    const thresholds = [...new Set(input.thresholds ?? [])].sort((a, b) => a - b);
    if (control === FilterControl.AREA) return { control, placement, attributeKey: null, optionKey: null, thresholds: [] };

    const entry = input.attributeKey ? pool.get(input.attributeKey) : undefined;
    if (!entry) throw this.refusal('FILTER_INVALID');
    if (control === FilterControl.GUESTS) {
      if (!GUEST_CAPACITY_ATTRIBUTE_KEYS.includes(entry.key)) throw this.refusal('FILTER_INVALID');
      if (!thresholds.length) throw this.refusal('FILTER_THRESHOLDS_REQUIRED');
      return { control, placement, attributeKey: entry.key, optionKey: null, thresholds };
    }
    if (!FILTER_CONTROLS_BY_TYPE[entry.type].includes(control)) throw this.refusal('FILTER_INVALID');
    if (control === FilterControl.OPTION_TOGGLE) {
      if (!entry.options.some((option) => option.key === input.optionKey)) throw this.refusal('FILTER_INVALID');
      return { control, placement, attributeKey: entry.key, optionKey: input.optionKey!, thresholds: [] };
    }
    if (control === FilterControl.MIN && !thresholds.length) throw this.refusal('FILTER_THRESHOLDS_REQUIRED');
    return {
      control,
      placement,
      attributeKey: entry.key,
      optionKey: null,
      thresholds: control === FilterControl.MIN ? thresholds : [],
    };
  }

  /**
   * The fields a category's filters can read, by key: its own and inherited
   * ones and its active subcategories', as SearchService.loadSearchFilters
   * reads them (a parent's "Sve" page reads its subcategories).
   */
  private async filterPool(categoryId: string): Promise<Map<string, PoolEntry>> {
    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId, status: 'ACTIVE' },
      select: { id: true },
    });
    const pool = new Map<string, PoolEntry>();
    for (const id of [categoryId, ...children.map((child) => child.id)]) {
      for (const attribute of await this.taxonomy.resolveAttributesForCategory(id)) {
        const entry = pool.get(attribute.key);
        if (!entry) {
          pool.set(attribute.key, {
            key: attribute.key,
            name: attribute.name,
            type: attribute.type,
            hidden: attribute.hidden,
            options: attribute.options.map(({ key, name, hidden }) => ({ key, name, hidden })),
          });
          continue;
        }
        entry.hidden = entry.hidden && attribute.hidden;
        for (const option of attribute.options) {
          if (!entry.options.some((known) => known.key === option.key)) {
            entry.options.push({ key: option.key, name: option.name, hidden: option.hidden });
          }
        }
      }
    }
    return pool;
  }

  /** Fields a key fact can show: everything but long text and the amenity groups (Uzrast dece is a fact). */
  private factPool(
    attributes: Array<{ id: string; key: string; type: AttributeType; hidden: boolean }>,
    names: Map<string, string>,
  ) {
    const pool = new Map<string, { key: string; name: string; type: AttributeType; hidden: boolean }>();
    for (const attribute of attributes) {
      if (attribute.type === AttributeType.TEXTAREA) continue;
      if (attribute.type === AttributeType.CHECKBOX_GROUP && attribute.key !== 'uzrast_dece') continue;
      if (!pool.has(attribute.key)) {
        pool.set(attribute.key, {
          key: attribute.key,
          name: names.get(attribute.id) ?? attribute.key,
          type: attribute.type,
          hidden: attribute.hidden,
        });
      }
    }
    return [...pool.values()];
  }

  /** A condition is an item of a single-choice field of the category or an ancestor, never the field itself. */
  private async validateCondition(
    categoryId: string,
    attrKey: string | null | undefined,
    optionKey: string | null | undefined,
    ownKey?: string,
  ): Promise<{ dependsOnAttrKey: string | null; dependsOnOptionKey: string | null }> {
    if (!attrKey && !optionKey) return { dependsOnAttrKey: null, dependsOnOptionKey: null };
    if (!attrKey || !optionKey || attrKey === ownKey) throw this.refusal('ATTRIBUTE_DEPENDS_INVALID');
    const parent = await this.prisma.categoryAttribute.findFirst({
      where: { categoryId: { in: await this.ancestorChain(categoryId) }, key: attrKey, type: AttributeType.LIST },
      include: { options: true },
    });
    if (!parent?.options.some((option) => option.key === optionKey)) throw this.refusal('ATTRIBUTE_DEPENDS_INVALID');
    return { dependsOnAttrKey: attrKey, dependsOnOptionKey: optionKey };
  }

  /** Fields across the category's tree conditioned on this field (or on one of its items). */
  private async dependentCount(categoryId: string, key: string, optionKey?: string) {
    const scope = [...(await this.ancestorChain(categoryId)), ...(await this.descendantIds(categoryId))];
    return this.prisma.categoryAttribute.count({
      where: { categoryId: { in: scope }, dependsOnAttrKey: key, ...(optionKey ? { dependsOnOptionKey: optionKey } : {}) },
    });
  }

  /**
   * A key for a new field: its name, lowercase with underscores, as the
   * seeded ones are. Unique along the category's ancestors and descendants
   * (which all read it); a sibling may share it, so a parent's "Sve" filter
   * reads both (Stanovi and Kuće each have broj_soba).
   */
  private async freeAttributeKey(categoryId: string, name: string) {
    const scope = [...(await this.ancestorChain(categoryId)), ...(await this.descendantIds(categoryId))];
    const taken = new Set(
      (await this.prisma.categoryAttribute.findMany({ where: { categoryId: { in: scope } }, select: { key: true } })).map(
        (attribute) => attribute.key,
      ),
    );
    const base = slugify(name).replace(/-/g, '_') || 'polje';
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
    return key;
  }

  /** A key for a new item: its name with hyphens, as the seeded ones are, unique in its field. */
  private freeOptionKey(taken: Set<string>, name: string) {
    const base = slugify(name) || 'stavka';
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
    return key;
  }

  private async writeName(tx: Prisma.TransactionClient, entityType: 'ATTRIBUTE' | 'OPTION', entityId: string, value: string) {
    await tx.translation.upsert({
      where: { entityType_entityId_field_language: { entityType, entityId, field: 'name', language: Language.SR } },
      update: { value },
      create: { entityType, entityId, field: 'name', language: Language.SR, value },
    });
  }

  /** Listings, deleted ones aside, that have a value for each field. */
  private async attributeUsage(attributeIds: string[]): Promise<Map<string, number>> {
    if (!attributeIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<Array<{ attributeId: string; count: number }>>`
      SELECT la."attributeId", COUNT(*)::int AS "count"
      FROM "ListingAttribute" la
      JOIN "Listing" l ON l."id" = la."listingId"
      WHERE la."attributeId" = ANY(${attributeIds}::uuid[]) AND l."status" <> 'DELETED'
      GROUP BY la."attributeId"`;
    return new Map(rows.map((row) => [row.attributeId, row.count]));
  }

  /** Listings, deleted ones aside, that picked each item of the given fields. */
  private async optionUsage(attributeIds: string[]): Promise<Map<string, number>> {
    if (!attributeIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<Array<{ optionId: string; count: number }>>`
      SELECT o."optionId", COUNT(DISTINCT la."listingId")::int AS "count"
      FROM "ListingAttribute" la
      JOIN "Listing" l ON l."id" = la."listingId"
      CROSS JOIN LATERAL unnest(la."valueOptionIds") AS o("optionId")
      WHERE la."attributeId" = ANY(${attributeIds}::uuid[]) AND l."status" <> 'DELETED'
      GROUP BY o."optionId"`;
    return new Map(rows.map((row) => [row.optionId, row.count]));
  }

  /** The category and its ancestors, the root first. */
  private async ancestorChain(categoryId: string): Promise<string[]> {
    const chain: string[] = [];
    let current = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, parentId: true } });
    while (current) {
      chain.unshift(current.id);
      current = current.parentId
        ? await this.prisma.category.findUnique({ where: { id: current.parentId }, select: { id: true, parentId: true } })
        : null;
    }
    return chain;
  }

  private async descendantIds(categoryId: string): Promise<string[]> {
    const ids: string[] = [];
    let frontier = [categoryId];
    for (let depth = 0; frontier.length && depth < 3; depth += 1) {
      const children = await this.prisma.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
      frontier = children.map((child) => child.id);
      ids.push(...frontier);
    }
    return ids;
  }

  private assertSameSet(current: string[], next: string[]) {
    const known = new Set(current);
    if (next.length !== current.length || new Set(next).size !== next.length || next.some((id) => !known.has(id))) {
      throw this.refusal('REORDER_INVALID');
    }
  }

  /** A refusal the panel acts on: the message, its code and the counts behind it. */
  private refusal(code: string, extra: { listingCount?: number; dependentCount?: number } = {}) {
    const count = extra.listingCount ?? extra.dependentCount;
    return new BadRequestException({
      message: this.i18n.t(`errors.${code}`, count === undefined ? undefined : { args: { count } }),
      code,
      ...extra,
    });
  }

  private async getCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    return category;
  }

  private async getAttribute(id: string) {
    const attribute = await this.prisma.categoryAttribute.findUnique({
      where: { id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!attribute) throw new NotFoundException();
    return attribute;
  }

  private async getOption(id: string) {
    const option = await this.prisma.attributeOption.findUnique({
      where: { id },
      include: { attribute: { select: { categoryId: true, key: true } } },
    });
    if (!option) throw new NotFoundException();
    return option;
  }

  private async getFilter(id: string) {
    const row = await this.prisma.categoryFilter.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }
}
