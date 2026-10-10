import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PriceUnit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BOOKING_MODEL_SETUPS, BookingModelKey, bookingModelKeyOf } from '../../common/utils/booking-models';
import { TaxonomyService } from './taxonomy.service';
import { ReorderModelsDto, SetCategoryModelsDto, UpdateBookingModelDto } from './dto/booking-model-admin.dto';

/**
 * T129 parts 3 and 4: Administracija > Rezervacioni modeli. The admin names,
 * describes, orders and switches the models on and off, narrows "Po
 * terminu" to per slot and/or per guest, and picks which models each
 * category offers with its default unit. What a model does stays in code
 * (common/utils/booking-models.ts), and none of it touches a listing already
 * on a model: TaxonomyService.getOfferedBookingModels only steers the wizard
 * and the next change of a listing's model.
 */
@Injectable()
export class BookingModelAdminService {
  constructor(
    private prisma: PrismaService,
    private taxonomy: TaxonomyService,
    private i18n: I18nService,
  ) {}

  /** The models, the categories in tree order with what each offers, and the listings on every model. */
  async overview() {
    const [models, categories, assignments, listings] = await Promise.all([
      this.prisma.bookingModelSetting.findMany({ orderBy: { displayOrder: 'asc' } }),
      this.prisma.category.findMany({
        where: { status: { in: ['ACTIVE', 'PROPOSED'] } },
        orderBy: [{ level: 'asc' }, { displayOrder: 'asc' }],
        select: { id: true, parentId: true, level: true, slug: true, status: true, published: true, allowedPriceUnits: true, defaultPriceUnit: true },
      }),
      this.prisma.categoryBookingModel.findMany(),
      this.prisma.listing.groupBy({
        by: ['categoryId', 'bookingModel', 'slotSubmode', 'priceUnit'],
        where: { status: { not: 'DELETED' } },
        _count: { _all: true },
      }),
    ]);
    const names = await this.taxonomy.getTranslationMap('CATEGORY', categories.map((category) => category.id));

    // Listings per category and model, read from their own fields.
    const counts = new Map<string, number>();
    for (const row of listings) {
      const key = bookingModelKeyOf(row);
      if (!key) continue;
      const id = `${row.categoryId}/${key}`;
      counts.set(id, (counts.get(id) ?? 0) + row._count._all);
    }
    const modelKeysOf = (categoryId: string) =>
      assignments.filter((row) => row.categoryId === categoryId).map((row) => row.modelKey);

    return {
      models: models.map((model) => {
        const setup = BOOKING_MODEL_SETUPS[model.key as BookingModelKey];
        const usedBy = categories.filter((category) => modelKeysOf(category.id).includes(model.key));
        return {
          ...model,
          // The units the admin can choose from; only "Po terminu" has two.
          possibleUnits: setup?.priceUnits ?? [],
          categories: usedBy.map((category) => ({ id: category.id, name: names.get(category.id) ?? category.slug })),
          listingCount: categories.reduce((sum, category) => sum + (counts.get(`${category.id}/${model.key}`) ?? 0), 0),
        };
      }),
      categories: categories.map((category) => ({
        ...category,
        name: names.get(category.id) ?? category.slug,
        modelKeys: modelKeysOf(category.id),
        listingCounts: Object.fromEntries(models.map((model) => [model.key, counts.get(`${category.id}/${model.key}`) ?? 0])),
      })),
    };
  }

  async updateModel(adminId: string, key: string, dto: UpdateBookingModelDto) {
    const model = await this.prisma.bookingModelSetting.findUnique({ where: { key } });
    if (!model) throw new NotFoundException();
    let priceUnits: PriceUnit[] | undefined;
    if (dto.priceUnits !== undefined) {
      const possible = BOOKING_MODEL_SETUPS[key as BookingModelKey]?.priceUnits ?? [];
      priceUnits = possible.filter((unit) => dto.priceUnits!.includes(unit));
      // An online model is priced by at least one unit; Samo kontakt by none.
      if (priceUnits.length !== new Set(dto.priceUnits).size || (possible.length > 0 && priceUnits.length === 0)) {
        throw new BadRequestException({ message: this.i18n.t('errors.BOOKING_MODEL_UNITS_INVALID'), code: 'BOOKING_MODEL_UNITS_INVALID' });
      }
    }
    const updated = await this.prisma.bookingModelSetting.update({
      where: { key },
      data: {
        name: dto.name?.trim() || undefined,
        description: dto.description === undefined ? undefined : dto.description.trim(),
        enabled: dto.enabled,
        priceUnits,
      },
    });
    await this.taxonomy.logChange(adminId, 'model.update', 'BookingModelSetting', key, model, updated);
    await this.taxonomy.invalidateTreeCache();
    return updated;
  }

  /** The order the wizard offers the models in. */
  async reorderModels(adminId: string, dto: ReorderModelsDto) {
    const models = await this.prisma.bookingModelSetting.findMany({ orderBy: { displayOrder: 'asc' } });
    const known = new Set(models.map((model) => model.key));
    if (dto.keys.length !== models.length || new Set(dto.keys).size !== dto.keys.length || dto.keys.some((key) => !known.has(key))) {
      throw new BadRequestException(this.i18n.t('errors.REORDER_INVALID'));
    }
    await this.prisma.$transaction(
      dto.keys.map((key, index) => this.prisma.bookingModelSetting.update({ where: { key }, data: { displayOrder: index } })),
    );
    await this.taxonomy.logChange(
      adminId,
      'model.reorder',
      'BookingModelSetting',
      'order',
      { order: models.map((model) => model.key) },
      { order: dto.keys },
    );
    await this.taxonomy.invalidateTreeCache();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /**
   * T129 part 4: the models a category offers, its units and its default
   * unit. A model given to it brings one of its units along when the category
   * allows none of them yet; no unit is taken away (a listing may use it).
   */
  async setCategoryModels(adminId: string, categoryId: string, dto: SetCategoryModelsDto) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException();
    const before = {
      modelKeys: (await this.prisma.categoryBookingModel.findMany({ where: { categoryId } })).map((row) => row.modelKey),
      allowedPriceUnits: category.allowedPriceUnits,
      defaultPriceUnit: category.defaultPriceUnit,
    };
    const fields = await this.taxonomy.bookingFieldsForModels(
      dto.modelKeys,
      dto.allowedPriceUnits ?? category.allowedPriceUnits,
      dto.defaultPriceUnit ?? category.defaultPriceUnit,
    );
    await this.prisma.$transaction([
      this.prisma.categoryBookingModel.deleteMany({ where: { categoryId } }),
      this.prisma.categoryBookingModel.createMany({ data: fields.modelKeys.map((modelKey) => ({ categoryId, modelKey })) }),
      this.prisma.category.update({
        where: { id: categoryId },
        data: {
          allowedPriceUnits: fields.allowedPriceUnits,
          defaultPriceUnit: fields.defaultPriceUnit,
          defaultBookingModel: fields.defaultBookingModel,
        },
      }),
    ]);
    const after = {
      modelKeys: fields.modelKeys,
      allowedPriceUnits: fields.allowedPriceUnits,
      defaultPriceUnit: fields.defaultPriceUnit,
    };
    await this.taxonomy.logChange(adminId, 'category.models', 'Category', categoryId, before, after);
    await this.taxonomy.invalidateTreeCache(categoryId);
    return after;
  }

  /** The changes to the models themselves (a category's own are in its history). */
  async history() {
    return this.prisma.adminLog.findMany({
      where: { entityType: 'BookingModelSetting' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }
}
