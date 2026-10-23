import { StorageScanService } from './storage-scan.service';

const BASE = 'http://localhost:3001/media';
const NOW = new Date('2026-11-20T04:45:00Z');
const OLD = new Date('2026-11-01T00:00:00Z');
const FRESH = new Date('2026-11-20T03:00:00Z');
const POLICY = {
  listingPhotoRetentionDays: 30,
  accountAttachmentRetentionDays: 30,
  scanFrequency: 'weekly',
  photoMaxMb: 8,
  attachmentMaxMb: 5,
  pricing: { baseMonthlyEur: 6.49, includedTb: 1, extraTbEur: 8.7 },
};

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
const photo = (listing: number, n: number) => `listings/${uuid(listing)}/photos/${uuid(n)}`;
const attachment = (n: number) => `conversations/${uuid(1)}/${uuid(2)}/${uuid(n)}.pdf`;

function makeStorage(objects: { public?: Array<[string, Date, number?]>; private?: Array<[string, Date, number?]> }) {
  return {
    publicBaseUrl: BASE,
    async *list(bucket: 'public' | 'private', prefix: string) {
      for (const [key, lastModified, size] of objects[bucket] ?? []) {
        if (key.startsWith(prefix)) yield { key, lastModified, size: size ?? 100 };
      }
    },
    deletePrefix: jest.fn(async () => 1),
    deleteObject: jest.fn(async () => undefined),
  };
}

function makeService(prisma: any, storage: any, events = { emit: jest.fn() }) {
  const settings = { get: jest.fn(async () => POLICY) };
  const i18n = { t: (key: string) => key };
  return new StorageScanService(prisma, storage, settings as any, events as any, i18n as any);
}

/** The reads a check makes, from plain lists; writes are recorded. */
function makeScanPrisma(state: {
  photos?: string[];
  livePhotos?: string[];
  avatars?: string[];
  attachments?: string[];
  holds?: string[];
  deletedListings?: any[];
  expiredAttachments?: any[];
  fieldIcons?: string[];
  itemIcons?: string[];
}) {
  const written: any = { items: [], superseded: null, scan: null };
  const tx = {
    storageScanItem: {
      createMany: jest.fn(async ({ data }: any) => written.items.push(...data)),
      updateMany: jest.fn(async (args: any) => (written.superseded = args)),
    },
    storageScan: { update: jest.fn(async (args: any) => (written.scan = args)) },
  };
  return {
    written,
    listingPhoto: {
      findMany: jest.fn(async (args: any) =>
        (args?.where?.listing ? (state.livePhotos ?? []) : (state.photos ?? [])).map((url) => ({ url })),
      ),
    },
    user: { findMany: jest.fn(async () => (state.avatars ?? []).map((avatarUrl) => ({ avatarUrl }))) },
    category: { findMany: jest.fn(async () => []) },
    categoryAttribute: { findMany: jest.fn(async () => (state.fieldIcons ?? []).map((icon) => ({ icon }))) },
    attributeOption: { findMany: jest.fn(async () => (state.itemIcons ?? []).map((icon) => ({ icon }))) },
    setting: { findMany: jest.fn(async () => []) },
    messageAttachment: {
      findMany: jest.fn(async (args: any) =>
        args?.where?.message ? (state.expiredAttachments ?? []) : (state.attachments ?? []).map((url) => ({ url })),
      ),
    },
    storageHold: { findMany: jest.fn(async () => (state.holds ?? []).map((key) => ({ key }))) },
    listing: { findMany: jest.fn(async () => state.deletedListings ?? []) },
    storageScan: { update: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (run: any) => run(tx)),
  };
}

describe('StorageScanService#run (T143): it lists, it never deletes', () => {
  it('lists forgotten folders and attachments a day old, and nothing in use, young or kept', async () => {
    const storage = makeStorage({
      public: [
        [`${photo(1, 2)}/400.webp`, OLD, 1000],
        [`${photo(1, 2)}/master.webp`, OLD, 5000],
        [`${photo(1, 3)}/400.webp`, OLD],
        [`${photo(1, 4)}/400.webp`, FRESH],
        [`${photo(1, 5)}/400.webp`, OLD],
        [`site/storage-check/${uuid(9)}/check.txt`, OLD],
      ],
      private: [
        [attachment(10), OLD, 300],
        [attachment(11), OLD],
      ],
    });
    const prisma = makeScanPrisma({ photos: [photo(1, 3)], attachments: [attachment(11)], holds: [photo(1, 5)] });

    await makeService(prisma, storage).run('scan-1', NOW);

    expect(prisma.written.items).toEqual([
      expect.objectContaining({ scanId: 'scan-1', bucket: 'public', key: photo(1, 2), reason: 'ORPHAN', files: 2, bytes: 6000 }),
      expect.objectContaining({ scanId: 'scan-1', bucket: 'private', key: attachment(10), reason: 'ORPHAN', files: 1, bytes: 300 }),
    ]);
    expect(storage.deletePrefix).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.written.superseded).toEqual({ where: { status: 'PENDING', scanId: { not: 'scan-1' } }, data: { status: 'SUPERSEDED' } });
    expect(prisma.written.scan.data).toMatchObject({ status: 'DONE', warning: false });
    expect(prisma.written.scan.data.usage.kinds.listingPhoto).toEqual({ items: 4, files: 5, bytes: 6300 });
    expect(prisma.written.scan.data.usage.kinds.other).toEqual({ items: 0, files: 1, bytes: 100 });
    expect(prisma.written.scan.data.usage.private).toEqual({ files: 2, bytes: 400 });
  });

  it('lists an uploaded field or item icon nothing wears, and keeps the worn ones (T129)', async () => {
    const icon = (n: number) => `site/attribute-icons/${uuid(n)}`;
    const storage = makeStorage({
      public: [
        [`${icon(1)}/128.webp`, OLD, 200],
        [`${icon(1)}/master.webp`, OLD, 800],
        [`${icon(2)}/128.webp`, OLD],
        [`${icon(3)}/128.webp`, OLD],
      ],
    });
    const prisma = makeScanPrisma({ fieldIcons: [icon(2)], itemIcons: [icon(3), icon(3)] });

    await makeService(prisma, storage).run('scan-icons', NOW);

    expect(prisma.written.items).toEqual([expect.objectContaining({ key: icon(1), reason: 'ORPHAN', files: 2, bytes: 1000 })]);
    expect(prisma.written.scan.data.usage.kinds.attributeIcon).toEqual({ items: 3, files: 4, bytes: 1200 });
  });

  it('lists the photos of a listing deleted past its retention, unless a live listing uses them too', async () => {
    const storage = makeStorage({ public: [[`${photo(7, 1)}/400.webp`, OLD], [`${photo(7, 2)}/400.webp`, OLD]] });
    const prisma = makeScanPrisma({
      photos: [photo(7, 1), photo(7, 2)],
      livePhotos: [photo(7, 2)],
      deletedListings: [
        {
          id: uuid(7),
          title: 'Vikendica',
          slug: 'vikendica',
          deletedAt: new Date('2026-10-01T00:00:00Z'),
          photos: [{ url: photo(7, 1) }, { url: photo(7, 2) }],
        },
      ],
    });

    await makeService(prisma, storage).run('scan-2', NOW);

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'DELETED', deletedAt: { lt: new Date('2026-10-21T04:45:00Z') }, photos: { some: {} } },
      }),
    );
    expect(prisma.written.items).toEqual([
      expect.objectContaining({
        key: photo(7, 1),
        reason: 'DELETED_LISTING',
        sourceId: uuid(7),
        dueAt: new Date('2026-10-31T00:00:00Z'),
        context: expect.objectContaining({ title: 'Vikendica' }),
      }),
    ]);
  });

  it('lists the attachments of an account deleted past its retention', async () => {
    const storage = makeStorage({ private: [[attachment(20), OLD, 500]] });
    const deletedAt = new Date('2026-10-05T00:00:00Z');
    const prisma = makeScanPrisma({
      attachments: [attachment(20)],
      expiredAttachments: [
        {
          id: uuid(20),
          url: attachment(20),
          filename: 'ugovor.pdf',
          message: { conversationId: uuid(1), sentAt: OLD, sender: { anonymizedAt: deletedAt } },
        },
      ],
    });

    await makeService(prisma, storage).run('scan-3', NOW);

    expect(prisma.written.items).toEqual([
      expect.objectContaining({
        bucket: 'private',
        key: attachment(20),
        reason: 'DELETED_ACCOUNT',
        sourceId: uuid(20),
        dueAt: new Date('2026-11-04T00:00:00Z'),
        context: expect.objectContaining({ filename: 'ugovor.pdf' }),
      }),
    ]);
  });

  it('warns when most of a bucket would be listed', async () => {
    const storage = makeStorage({
      public: Array.from({ length: 30 }, (_, i) => [`${photo(1, i + 10)}/400.webp`, OLD] as [string, Date]),
    });
    const prisma = makeScanPrisma({});

    await makeService(prisma, storage).run('scan-4', NOW);

    expect(prisma.written.items).toHaveLength(30);
    expect(prisma.written.scan.data.warning).toBe(true);
    expect(storage.deletePrefix).not.toHaveBeenCalled();
  });

  it('marks a check that fails as FAILED', async () => {
    const storage = {
      publicBaseUrl: BASE,
      // eslint-disable-next-line require-yield
      async *list() {
        throw new Error('network');
      },
    };
    const prisma = makeScanPrisma({});

    await makeService(prisma, storage).run('scan-5', NOW);

    expect(prisma.storageScan.update).toHaveBeenCalledWith({
      where: { id: 'scan-5' },
      data: expect.objectContaining({ status: 'FAILED', error: 'network' }),
    });
  });
});

describe('StorageScanService#deleteItems (T143): only what an admin approved, checked again', () => {
  function makeDeletePrisma(items: any[], extra: any = {}) {
    const updates: any[] = [];
    return {
      updates,
      storageScan: { findFirst: jest.fn(async () => null) },
      storageScanItem: {
        findMany: jest.fn(async () => items),
        update: jest.fn(async (args: any) => updates.push(args)),
      },
      storageHold: { findMany: jest.fn(async () => (extra.holds ?? []).map((key: string) => ({ key }))) },
      messageAttachment: {
        findFirst: jest.fn(async () => extra.attachment ?? null),
        deleteMany: jest.fn(),
      },
      listingPhoto: { findMany: jest.fn(async () => extra.photoRows ?? []), deleteMany: jest.fn() },
      user: { findFirst: jest.fn(async () => extra.avatarUser ?? null) },
      category: { findFirst: jest.fn(async () => null) },
      categoryAttribute: { findFirst: jest.fn(async () => extra.iconField ?? null) },
      attributeOption: { findFirst: jest.fn(async () => extra.iconItem ?? null) },
      setting: { findUnique: jest.fn(async () => null) },
      adminLog: { create: jest.fn() },
    };
  }
  const item = (overrides: any) => ({
    id: 'i1',
    bucket: 'public',
    key: photo(1, 2),
    reason: 'ORPHAN',
    sourceId: null,
    files: 1,
    bytes: 1,
    ...overrides,
  });

  it('deletes a forgotten folder that is still forgotten', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma([item({})]);

    const result = await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deletePrefix).toHaveBeenCalledWith('public', `${photo(1, 2)}/`);
    expect(result).toEqual({ deleted: 1, skipped: 0, failed: 0, notPending: 0 });
    expect(prisma.updates[0].data).toMatchObject({ status: 'DELETED', decidedById: 'admin' });
    expect(prisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'admin', action: 'storage.files_deleted', entityType: 'Storage' }),
    });
  });

  it('leaves an avatar folder that a user picked up again meanwhile', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma([item({ key: `users/${uuid(3)}/avatar/${uuid(4)}` })], { avatarUser: { id: 'u' } });

    const result = await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deletePrefix).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(prisma.updates[0].data).toMatchObject({ status: 'SKIPPED', note: 'in_use' });
  });

  it('leaves an uploaded icon that a field or an item wears again meanwhile (T129)', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma([item({ key: `site/attribute-icons/${uuid(5)}` })], { iconItem: { id: 'o1' } });

    const result = await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deletePrefix).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(prisma.updates[0].data).toMatchObject({ status: 'SKIPPED', note: 'in_use' });
  });

  it('leaves the photos of a listing brought back meanwhile', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma([item({ reason: 'DELETED_LISTING', sourceId: uuid(1) })], {
      photoRows: [{ listing: { status: 'ACTIVE', deletedAt: null } }],
    });

    await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deletePrefix).not.toHaveBeenCalled();
    expect(prisma.updates[0].data).toMatchObject({ status: 'SKIPPED', note: 'restored' });
  });

  it('deletes the photos and rows of a listing still deleted past its retention', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma([item({ reason: 'DELETED_LISTING', sourceId: uuid(1) })], {
      photoRows: [{ listing: { status: 'DELETED', deletedAt: new Date('2026-09-01T00:00:00Z') } }],
    });

    await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deletePrefix).toHaveBeenCalledWith('public', `${photo(1, 2)}/`);
    expect(prisma.listingPhoto.deleteMany).toHaveBeenCalledWith({
      where: { url: { contains: photo(1, 2) }, listing: { status: 'DELETED' } },
    });
  });

  it('leaves an attachment whose account is not past its retention any more (the period was made longer)', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma(
      [item({ bucket: 'private', key: attachment(5), reason: 'DELETED_ACCOUNT', sourceId: uuid(5) })],
      { attachment: { message: { sender: { anonymizedAt: new Date('2026-11-10T00:00:00Z') } } } },
    );

    await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.updates[0].data).toMatchObject({ status: 'SKIPPED', note: 'not_expired' });
  });

  it('deletes an expired attachment with its record', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma(
      [item({ bucket: 'private', key: attachment(5), reason: 'DELETED_ACCOUNT', sourceId: uuid(5) })],
      { attachment: { message: { sender: { anonymizedAt: new Date('2026-09-10T00:00:00Z') } } } },
    );

    await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);

    expect(storage.deleteObject).toHaveBeenCalledWith('private', attachment(5));
    expect(prisma.messageAttachment.deleteMany).toHaveBeenCalledWith({ where: { id: uuid(5), url: attachment(5) } });
  });

  it('never deletes a kept file, and refuses while a check runs', async () => {
    const storage = makeStorage({});
    const prisma = makeDeletePrisma([item({})], { holds: [photo(1, 2)] });

    await makeService(prisma, storage).deleteItems('admin', ['i1'], NOW);
    expect(storage.deletePrefix).not.toHaveBeenCalled();
    expect(prisma.updates[0].data).toMatchObject({ status: 'SKIPPED', note: 'held' });

    prisma.storageScan.findFirst.mockResolvedValueOnce({ id: 'running' } as never);
    await expect(makeService(prisma, storage).deleteItems('admin', ['i1'], NOW)).rejects.toThrow('errors.STORAGE_SCAN_RUNNING');
  });

  it('keeps a file for good when asked to', async () => {
    const prisma: any = {
      storageScanItem: { findMany: jest.fn(async () => [item({})]), update: jest.fn((args: any) => args) },
      storageHold: { upsert: jest.fn((args: any) => args) },
      $transaction: jest.fn(async (ops: any[]) => ops),
      adminLog: { create: jest.fn() },
    };

    const result = await makeService(prisma, makeStorage({})).keepItems('admin', ['i1', 'gone'], NOW);

    expect(prisma.storageHold.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: photo(1, 2) }, create: expect.objectContaining({ createdById: 'admin' }) }),
    );
    expect(result).toEqual({ kept: 1, notPending: 1 });
  });
});

describe('StorageScanService#remindOverdueAccountFiles (T143)', () => {
  function makeReminderPrisma(urls: string[], recentEmail: boolean) {
    return {
      messageAttachment: { findMany: jest.fn(async () => urls.map((url) => ({ url }))) },
      storageHold: { count: jest.fn(async () => 0) },
      emailLog: { findFirst: jest.fn(async () => (recentEmail ? { id: 'e' } : null)) },
    };
  }

  it('reminds the admins once a day while attachments of deleted accounts wait', async () => {
    const events = { emit: jest.fn() };
    await makeService(makeReminderPrisma([attachment(1), attachment(2)], false), makeStorage({}), events).remindOverdueAccountFiles(NOW);
    expect(events.emit).toHaveBeenCalledWith('storage.deletion_pending', { count: 2 });

    const quiet = { emit: jest.fn() };
    await makeService(makeReminderPrisma([attachment(1)], true), makeStorage({}), quiet).remindOverdueAccountFiles(NOW);
    await makeService(makeReminderPrisma([], false), makeStorage({}), quiet).remindOverdueAccountFiles(NOW);
    expect(quiet.emit).not.toHaveBeenCalled();
  });
});
