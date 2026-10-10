import { bookingModelKeyOf, defaultBookingModelFor, modelKeysForCategory } from '../../common/utils/booking-models';
import { BookingModelAdminService } from './booking-model-admin.service';
import { TaxonomyService } from './taxonomy.service';

const i18n = { t: (key: string) => key };

describe('booking models as data (T129 parts 3 and 4)', () => {
  it('reads the model a listing is on from its fields', () => {
    expect(bookingModelKeyOf({ bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', priceUnit: 'GUEST' })).toBe('DEFINED_SLOTS');
    expect(bookingModelKeyOf({ bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS', priceUnit: 'HOUR' })).toBe('WORKING_HOURS');
    expect(bookingModelKeyOf({ bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS', priceUnit: 'GUEST' })).toBe('WORKING_HOURS_GUEST');
    expect(bookingModelKeyOf({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'MONTH' })).toBe('MONTH');
    expect(bookingModelKeyOf({ bookingModel: 'NO_BOOKING', slotSubmode: null, priceUnit: 'SLOT' })).toBe('CONTACT');
    // T126: a stay by the hour is no model.
    expect(bookingModelKeyOf({ bookingModel: 'PER_STAY', slotSubmode: null, priceUnit: 'HOUR' })).toBeNull();
  });

  it('gives each seeded category what it offered before', () => {
    const of = (slug: string, defaultBookingModel: any, allowedPriceUnits: any[]) =>
      modelKeysForCategory({ slug, defaultBookingModel, allowedPriceUnits });
    expect(of('stanovi', 'PER_STAY', ['NIGHT', 'MONTH'])).toEqual(['NIGHT', 'MONTH', 'CONTACT']);
    expect(of('sale-za-proslave', 'PER_SLOT', ['SLOT', 'GUEST'])).toEqual(['DEFINED_SLOTS', 'CONTACT']);
    expect(of('konferencijske-sale', 'PER_SLOT', ['HOUR'])).toEqual(['WORKING_HOURS', 'CONTACT']);
    expect(of('igraonice', 'PER_SLOT', ['HOUR', 'SLOT'])).toEqual(['DEFINED_SLOTS', 'WORKING_HOURS', 'CONTACT']);
    expect(of('magacini-i-skladista', 'PER_STAY', ['MONTH'])).toEqual(['MONTH', 'CONTACT']);
  });

  it('starts a new listing on the model of the default unit', () => {
    expect(defaultBookingModelFor(['DAY', 'WORKING_HOURS', 'CONTACT'], 'HOUR')).toBe('PER_SLOT');
    expect(defaultBookingModelFor(['DAY', 'WORKING_HOURS', 'CONTACT'], 'DAY')).toBe('PER_STAY');
    expect(defaultBookingModelFor(['CONTACT'], 'DAY')).toBe('NO_BOOKING');
  });

  it('offers the assigned models that are on, with the units the category allows, in the admin order', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({
          allowedPriceUnits: ['HOUR', 'SLOT'],
          bookingModels: [
            { model: { key: 'WORKING_HOURS', name: 'Po satu', description: '', enabled: true, priceUnits: ['HOUR'], displayOrder: 1 } },
            { model: { key: 'DEFINED_SLOTS', name: 'Po terminu', description: '', enabled: true, priceUnits: ['SLOT', 'GUEST'], displayOrder: 0 } },
            { model: { key: 'MONTH', name: 'Po mesecu', description: '', enabled: false, priceUnits: ['MONTH'], displayOrder: 5 } },
            { model: { key: 'WORKING_HOURS_GUEST', name: 'Po gostu', description: '', enabled: true, priceUnits: ['GUEST'], displayOrder: 2 } },
            { model: { key: 'CONTACT', name: 'Samo kontakt', description: '', enabled: true, priceUnits: [], displayOrder: 6 } },
          ],
        }),
      },
    };
    const cache = { getOrSet: jest.fn((_k: string, _t: number, compute: () => unknown) => compute()) };
    const taxonomy = new TaxonomyService(prisma as any, cache as any, i18n as any, {} as any, {} as any);
    const offered = await taxonomy.getOfferedBookingModels('c1');
    // Off (MONTH) is left out, and so is per guest: the category allows no GUEST.
    expect(offered.map((model) => [model.key, model.priceUnits])).toEqual([
      ['DEFINED_SLOTS', ['SLOT']],
      ['WORKING_HOURS', ['HOUR']],
      ['CONTACT', []],
    ]);
  });

  it('brings a unit along with a model the category allows none of, and keeps every unit it had', async () => {
    const tx: any[] = [];
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', allowedPriceUnits: ['DAY'], defaultPriceUnit: 'DAY' }),
        update: jest.fn((args) => (tx.push(args), args)),
      },
      categoryBookingModel: {
        findMany: jest.fn().mockResolvedValue([{ modelKey: 'DAY' }, { modelKey: 'CONTACT' }]),
        deleteMany: jest.fn((args) => args),
        createMany: jest.fn((args) => (tx.push(args), args)),
      },
      bookingModelSetting: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'WORKING_HOURS', priceUnits: ['HOUR'] },
          { key: 'CONTACT', priceUnits: [] },
        ]),
      },
      adminLog: { create: jest.fn() },
      $transaction: jest.fn(async (ops) => ops),
    };
    const cache = { del: jest.fn(), delByPrefix: jest.fn() };
    const taxonomy = new TaxonomyService(prisma as any, cache as any, i18n as any, {} as any, {} as any);
    const service = new BookingModelAdminService(prisma as any, taxonomy, i18n as any);

    // "Tamara modelu Po danu dodeli Vozila i ukloni Po satu": here the other way round.
    const saved = await service.setCategoryModels('admin-1', 'c1', { modelKeys: ['WORKING_HOURS', 'CONTACT'] });
    expect(saved).toEqual({ modelKeys: ['WORKING_HOURS', 'CONTACT'], allowedPriceUnits: ['DAY', 'HOUR'], defaultPriceUnit: 'DAY' });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { allowedPriceUnits: ['DAY', 'HOUR'], defaultPriceUnit: 'DAY', defaultBookingModel: 'PER_SLOT' },
    });
    await expect(service.setCategoryModels('admin-1', 'c1', { modelKeys: [] })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BOOKING_MODELS_INVALID' }),
    });
  });

  it('keeps an online model priced by at least one unit it supports', async () => {
    const prisma = {
      bookingModelSetting: {
        findUnique: jest.fn().mockResolvedValue({ key: 'DEFINED_SLOTS', priceUnits: ['SLOT', 'GUEST'] }),
        update: jest.fn(async ({ data }) => ({ key: 'DEFINED_SLOTS', ...data })),
      },
    };
    const taxonomy = { logChange: jest.fn(), invalidateTreeCache: jest.fn() };
    const service = new BookingModelAdminService(prisma as any, taxonomy as any, i18n as any);
    for (const priceUnits of [[], ['HOUR'], ['SLOT', 'NIGHT']]) {
      await expect(service.updateModel('admin-1', 'DEFINED_SLOTS', { priceUnits: priceUnits as any })).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'BOOKING_MODEL_UNITS_INVALID' }),
      });
    }
    await expect(service.updateModel('admin-1', 'DEFINED_SLOTS', { priceUnits: ['GUEST'] })).resolves.toMatchObject({
      priceUnits: ['GUEST'],
    });
  });
});
