import { StorageLookupService } from './storage-lookup.service';

const L = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001';
const F = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';
const PHOTO = `listings/${L}/photos/${F}`;
const ATTACHMENT = `conversations/${L}/${F}/${L}.pdf`;
const MODIFIED = new Date('2026-10-11T10:00:00Z');

function makeService(prisma: any) {
  const storage = {
    async *list(_bucket: string, prefix: string) {
      if (prefix === `${PHOTO}/`) {
        yield { key: `${PHOTO}/400.webp`, size: 30000, lastModified: MODIFIED };
        yield { key: `${PHOTO}/master.webp`, size: 900000, lastModified: MODIFIED };
      }
      if (prefix === ATTACHMENT) yield { key: ATTACHMENT, size: 5000, lastModified: MODIFIED };
    },
  };
  return new StorageLookupService(prisma, storage as any, { get: () => 'uploads' } as any);
}

function makePrisma(extra: any = {}) {
  return {
    listingPhoto: { findMany: jest.fn(async () => extra.photoRows ?? []) },
    messageAttachment: { findMany: jest.fn(async () => extra.attachmentRows ?? []) },
    storageHold: { findUnique: jest.fn(async () => extra.hold ?? null) },
    storageScanItem: { findFirst: jest.fn(async () => extra.item ?? null) },
  };
}

describe('StorageLookupService (T143)', () => {
  it('finds a photo by any of its URLs: what is stored and which listing uses it', async () => {
    const prisma = makePrisma({
      photoRows: [
        {
          listing: {
            id: L,
            title: 'Vikendica',
            slug: 'vikendica',
            status: 'ACTIVE',
            user: { firstName: 'Pera', lastName: 'Perić', email: 'pera@example.test' },
          },
        },
      ],
      item: { reason: 'ORPHAN' },
    });

    const result = await makeService(prisma).lookup(`https://cdn.example/${PHOTO}/800.webp?x=1`);

    expect(result).toMatchObject({
      recognized: true,
      kind: 'listingPhoto',
      where: 'public',
      location: `${PHOTO}/`,
      held: false,
      pending: 'ORPHAN',
      usedBy: [{ type: 'listing', id: L, label: 'Vikendica', link: '/oglasi/vikendica' }],
    });
    expect(result.files.map((file) => file.name)).toEqual(['400.webp', 'master.webp']);
    expect(prisma.listingPhoto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { url: { contains: PHOTO } } }));
  });

  it('finds an attachment by its signed link, without its signature', async () => {
    const prisma = makePrisma({
      attachmentRows: [
        {
          id: 'a1',
          filename: 'ugovor.pdf',
          message: { conversationId: L, sentAt: MODIFIED, sender: { firstName: 'Ana', lastName: 'Anić', anonymizedAt: null } },
        },
      ],
    });

    const result = await makeService(prisma).lookup(`http://localhost:3001/media-private/${ATTACHMENT}?expires=1&signature=abc`);

    expect(result).toMatchObject({ recognized: true, kind: 'attachment', where: 'private', location: ATTACHMENT });
    expect(result.files).toEqual([{ name: `${L}.pdf`, bytes: 5000, lastModified: MODIFIED }]);
    expect(result.usedBy[0]).toMatchObject({ type: 'message', label: 'ugovor.pdf' });
  });

  it('says so when the text is no link it knows', async () => {
    const result = await makeService(makePrisma()).lookup('https://example.com/slika.jpg');
    expect(result).toEqual({ recognized: false, files: [], usedBy: [], held: false, pending: null });
  });
});
