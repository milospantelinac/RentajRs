import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LegacyUploadsController } from './legacy-uploads.controller';

const L = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001';
const F = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';
const BASE = 'https://rentaj-prod-media.fsn1.your-objectstorage.com';

function makeRes() {
  return {
    set: jest.fn(),
    type: jest.fn(),
    redirect: jest.fn(),
    sendFile: jest.fn(),
  };
}

describe('LegacyUploadsController (T143)', () => {
  let dir: string;
  const config = { get: () => dir };
  const storage = { publicBaseUrl: BASE };

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rentaj-legacy-'));
    await fs.mkdir(path.join(dir, 'listings', L), { recursive: true });
    await fs.writeFile(path.join(dir, 'listings', L, `${F}.webp`), 'old');
    await fs.mkdir(path.join(dir, 'avatars'), { recursive: true });
    await fs.writeFile(path.join(dir, 'avatars', `${F}.webp`), 'old');
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('sends the old address of a moved listing photo to its new file for good', async () => {
    // Moved under the listing whose row it is, which an old address copied from elsewhere does not name.
    const OTHER = '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
    const prisma = { listingPhoto: { findFirst: jest.fn(async () => ({ url: `listings/${OTHER}/photos/${F}` })) } };
    const res = makeRes();

    await new LegacyUploadsController(prisma as any, config as any, storage as any).listingPhoto(L, `${F}.webp`, res as any);

    expect(prisma.listingPhoto.findFirst).toHaveBeenCalledWith({ where: { url: { endsWith: `/photos/${F}` } }, select: { url: true } });
    expect(res.redirect).toHaveBeenCalledWith(301, `${BASE}/listings/${OTHER}/photos/${F}/1920.webp`);
  });

  it('serves a photo not moved yet from disk while its listing still has it', async () => {
    const prisma = {
      listingPhoto: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'p1' }) },
    };
    const res = makeRes();

    await new LegacyUploadsController(prisma as any, config as any, storage as any).listingPhoto(L, `${F}.webp`, res as any);

    expect(res.type).toHaveBeenCalledWith('image/webp');
    expect(res.sendFile).toHaveBeenCalledWith(path.resolve(dir, 'listings', L, `${F}.webp`));
  });

  it('answers 404 for a file no record points at any more, even if it is still on disk', async () => {
    const prisma = { user: { findFirst: jest.fn(async () => null) } };
    const res = makeRes();

    await expect(
      new LegacyUploadsController(prisma as any, config as any, storage as any).file('avatars', `${F}.webp`, res as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('refuses names that are not the old generated ones', async () => {
    const controller = new LegacyUploadsController({} as any, config as any, storage as any);
    await expect(controller.file('avatars', '..%2F.env', makeRes() as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.listingPhoto('x', `${F}.webp`, makeRes() as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.file('media', `${F}.webp`, makeRes() as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
