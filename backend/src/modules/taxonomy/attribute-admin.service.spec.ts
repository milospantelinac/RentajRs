import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttributeAdminService } from './attribute-admin.service';
import { CreateOptionDto, UpdateAttributeDto, UpdateOptionDto } from './dto/attribute-admin.dto';

const i18n = { t: (key: string) => key };

function makeTaxonomy(resolved: Record<string, any[]> = {}) {
  return {
    getTranslationMap: jest.fn().mockResolvedValue(new Map()),
    getFactKeys: jest.fn().mockResolvedValue({ cardFactKeys: [], listingFactKeys: [] }),
    logChange: jest.fn().mockResolvedValue(undefined),
    invalidateTreeCache: jest.fn().mockResolvedValue(undefined),
    resolveAttributesForCategory: jest.fn(async (id: string) => resolved[id] ?? []),
  };
}

// A leaf ("sobe") under a main category ("nek").
function treePrisma(extra: Record<string, any> = {}): any {
  const categories: Record<string, { id: string; parentId: string | null }> = {
    nek: { id: 'nek', parentId: null },
    sobe: { id: 'sobe', parentId: 'nek' },
  };
  return {
    category: {
      findUnique: jest.fn(async ({ where }) => (categories[where.id] ? { ...categories[where.id], cardFactKeys: [], listingFactKeys: [] } : null)),
      findMany: jest.fn(async ({ where }) =>
        Object.values(categories).filter((c) => (where.parentId?.in ?? [where.parentId]).includes(c.parentId)),
      ),
      update: jest.fn(async ({ data }) => ({ cardFactKeys: data.cardFactKeys ?? [], listingFactKeys: data.listingFactKeys ?? [] })),
    },
    ...extra,
  };
}

describe('AttributeAdminService (T129 part 2)', () => {
  it('makes a key from the name, unique along the category tree, and hyphenated keys for its items', async () => {
    const created: any[] = [];
    const options: any[] = [];
    const tx = {
      categoryAttribute: { create: jest.fn(async ({ data }) => (created.push(data), { id: 'a-new', ...data })) },
      attributeOption: { create: jest.fn(async ({ data }) => (options.push(data), { id: `o${options.length}`, ...data })) },
      translation: { upsert: jest.fn() },
    };
    const prisma = treePrisma({
      categoryAttribute: {
        findMany: jest.fn().mockResolvedValue([{ key: 'povrsina' }]),
        findFirst: jest.fn().mockResolvedValue({ displayOrder: 4 }),
      },
      $transaction: jest.fn(async (fn) => fn(tx)),
    });
    const service = new AttributeAdminService(prisma as any, makeTaxonomy() as any, i18n as any, {} as any);

    await service.createAttribute('admin-1', 'sobe', {
      name: 'Površina',
      type: 'CHECKBOX_GROUP',
      options: [{ name: 'Kućni ljubimci dozvoljeni' }, { name: 'Kućni ljubimci dozvoljeni' }],
    } as any);

    expect(created[0]).toMatchObject({ categoryId: 'sobe', key: 'povrsina_2', displayOrder: 5, showOnListing: true });
    expect(options.map((option) => option.key)).toEqual(['kucni-ljubimci-dozvoljeni', 'kucni-ljubimci-dozvoljeni-2']);
  });

  it('never deletes a system field, nor one in use, nor one other fields depend on', async () => {
    const attribute = (key: string) => ({ id: 'a1', categoryId: 'sobe', key, type: 'NUMBER', options: [] });
    const usage = jest.fn();
    const prisma = treePrisma({
      categoryAttribute: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(2) },
      $queryRaw: usage,
    });
    const service = new AttributeAdminService(prisma as any, makeTaxonomy() as any, i18n as any, {} as any);

    prisma.categoryAttribute.findUnique.mockResolvedValueOnce(attribute('kapacitet_ljudi'));
    await expect(service.deleteAttribute('admin-1', 'a1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ATTRIBUTE_SYSTEM' }) });

    prisma.categoryAttribute.findUnique.mockResolvedValueOnce(attribute('tip_masine'));
    usage.mockResolvedValueOnce([{ attributeId: 'a1', count: 7 }]);
    await expect(service.deleteAttribute('admin-1', 'a1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ATTRIBUTE_IN_USE', listingCount: 7 }),
    });

    prisma.categoryAttribute.findUnique.mockResolvedValueOnce(attribute('tip_masine'));
    usage.mockResolvedValueOnce([]);
    await expect(service.deleteAttribute('admin-1', 'a1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ATTRIBUTE_HAS_DEPENDENTS', dependentCount: 2 }),
    });
  });

  it('refuses to hide a system field or change the type of a field listings use', async () => {
    const prisma = treePrisma({
      categoryAttribute: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ attributeId: 'a1', count: 3 }]),
    });
    const service = new AttributeAdminService(prisma as any, makeTaxonomy() as any, i18n as any, {} as any);

    prisma.categoryAttribute.findUnique.mockResolvedValueOnce({ id: 'a1', categoryId: 'sobe', key: 'kapacitet_dece', type: 'NUMBER', options: [] });
    await expect(service.updateAttribute('admin-1', 'a1', { hidden: true })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ATTRIBUTE_SYSTEM' }),
    });

    prisma.categoryAttribute.findUnique.mockResolvedValueOnce({ id: 'a1', categoryId: 'sobe', key: 'sprat', type: 'NUMBER', options: [] });
    await expect(service.updateAttribute('admin-1', 'a1', { type: 'TEXT' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ATTRIBUTE_TYPE_LOCKED', listingCount: 3 }),
    });
  });

  describe('filters', () => {
    const resolved = {
      sobe: [
        { key: 'kvadratura', name: 'Kvadratura', type: 'NUMBER', hidden: false, options: [] },
        {
          key: 'sadrzaji',
          name: 'Sadržaji',
          type: 'CHECKBOX_GROUP',
          hidden: false,
          options: [{ key: 'kucni-ljubimci-dozvoljeni', name: 'Kućni ljubimci dozvoljeni', hidden: false }],
        },
      ],
    };
    function setup(rows: any[] = []) {
      const prisma = treePrisma({
        categoryFilter: {
          findMany: jest.fn().mockResolvedValue(rows),
          create: jest.fn(async ({ data }) => ({ id: 'f-new', ...data })),
        },
      });
      prisma.category.findMany = jest.fn().mockResolvedValue([]);
      const service = new AttributeAdminService(prisma as any, makeTaxonomy(resolved) as any, i18n as any, {} as any);
      return { prisma, service };
    }

    it('takes a kind only where /pretraga can draw it and only for a field type it reads', async () => {
      const { service } = setup();
      // An od-do range has no pill in the bar.
      await expect(
        service.createFilter('admin-1', 'sobe', { control: 'RANGE', placement: 'BAR', attributeKey: 'kvadratura' } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'FILTER_INVALID' }) });
      // A yes/no switch reads a yes/no field, not a number.
      await expect(
        service.createFilter('admin-1', 'sobe', { control: 'TOGGLE', placement: 'PANEL', attributeKey: 'kvadratura' } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'FILTER_INVALID' }) });
      await expect(
        service.createFilter('admin-1', 'sobe', { control: 'MIN', placement: 'PANEL', attributeKey: 'kvadratura' } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'FILTER_THRESHOLDS_REQUIRED' }) });
    });

    it('saves an item switch under a key of its own, after the existing filters', async () => {
      const { prisma, service } = setup([{ key: 'area', control: 'AREA', attributeKey: null, optionKey: null, displayOrder: 3 }]);
      await service.createFilter('admin-1', 'sobe', {
        control: 'OPTION_TOGGLE',
        placement: 'PANEL',
        attributeKey: 'sadrzaji',
        optionKey: 'kucni-ljubimci-dozvoljeni',
      } as any);
      expect(prisma.categoryFilter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'sadrzaji_kucni-ljubimci-dozvoljeni',
          attributeKey: 'sadrzaji',
          optionKey: 'kucni-ljubimci-dozvoljeni',
          displayOrder: 4,
        }),
      });
    });

    it('refuses a second filter on the same field', async () => {
      const { service } = setup([{ key: 'kvadratura', control: 'RANGE', attributeKey: 'kvadratura', optionKey: null, displayOrder: 0 }]);
      await expect(
        service.createFilter('admin-1', 'sobe', { control: 'MIN', placement: 'PANEL', attributeKey: 'kvadratura', thresholds: [20] } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'FILTER_DUPLICATE' }) });
    });
  });

  it('takes as key facts only fields of the category, each once, never long text or amenity groups', async () => {
    const prisma = treePrisma({
      categoryAttribute: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a1', key: 'kvadratura', type: 'NUMBER', hidden: false, options: [] },
          { id: 'a2', key: 'opis_prostora', type: 'TEXTAREA', hidden: false, options: [] },
          { id: 'a3', key: 'sadrzaji', type: 'CHECKBOX_GROUP', hidden: false, options: [] },
        ]),
      },
    });
    const service = new AttributeAdminService(prisma as any, makeTaxonomy() as any, i18n as any, {} as any);
    for (const keys of [['opis_prostora'], ['sadrzaji'], ['kvadratura', 'kvadratura'], ['nepostojece']]) {
      await expect(service.setFactKeys('admin-1', 'sobe', { cardFactKeys: keys })).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'FACTS_INVALID' }),
      });
    }
    await expect(service.setFactKeys('admin-1', 'sobe', { cardFactKeys: ['kvadratura'] })).resolves.toEqual({
      cardFactKeys: ['kvadratura'],
      listingFactKeys: [],
    });
  });
});

describe('Uploaded icons of fields and amenity items (T129)', () => {
  const F = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';
  const KEY = `site/attribute-icons/${F}`;

  async function check(dtoClass: any, body: Record<string, unknown>): Promise<{ dto: any; errors: unknown[] }> {
    const dto = plainToInstance(dtoClass, body) as object;
    return { dto, errors: await validate(dto) };
  }

  it('takes a library name or an uploaded icon, read back from the URL the panel was shown to its key', async () => {
    const fromUrl = await check(UpdateOptionDto, { icon: `https://rentaj-media.example/${KEY}/128.webp` });
    expect(fromUrl.errors).toEqual([]);
    expect(fromUrl.dto.icon).toBe(KEY);

    for (const [dtoClass, body] of [
      [UpdateOptionDto, { icon: 'bazen' }],
      [UpdateOptionDto, { icon: KEY }],
      [UpdateOptionDto, { icon: null }],
      [UpdateOptionDto, { icon: '' }],
      [CreateOptionDto, { name: 'Džakuzi', icon: KEY }],
      [UpdateAttributeDto, { icon: `http://127.0.0.1:3335/media/${KEY}/128.webp` }],
    ] as const) {
      expect((await check(dtoClass, body)).errors).toEqual([]);
    }
  });

  it('refuses any other address or text', async () => {
    for (const icon of ['https://evil.example/icon.svg', `categories/${F}/${F}`, 'Bazen', '../site/attribute-icons/x']) {
      expect((await check(UpdateOptionDto, { icon })).errors).not.toEqual([]);
    }
  });

  it('stores an upload and lists the uploaded icons that fields and items wear, most worn first', async () => {
    const other = `site/attribute-icons/0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001`;
    const prisma = {
      categoryAttribute: { findMany: jest.fn().mockResolvedValue([{ icon: other }]) },
      attributeOption: { findMany: jest.fn().mockResolvedValue([{ icon: KEY }, { icon: other }, { icon: KEY }, { icon: KEY }]) },
    };
    const uploads = { saveAttributeIcon: jest.fn().mockResolvedValue(KEY) };
    const service = new AttributeAdminService(prisma as any, makeTaxonomy() as any, i18n as any, uploads as any);

    await expect(service.uploadIcon({ buffer: Buffer.from('') } as any)).resolves.toEqual({ icon: KEY });
    await expect(service.listUploadedIcons()).resolves.toEqual({
      icons: [
        { icon: KEY, uses: 3 },
        { icon: other, uses: 2 },
      ],
    });
    expect(prisma.attributeOption.findMany).toHaveBeenCalledWith({
      where: { icon: { startsWith: 'site/attribute-icons/' } },
      select: { icon: true },
    });
  });
});
