import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { UploadsService, inlineDisposition, uploadedFileName } from './uploads.service';

const BASE = 'http://localhost:3001/media';
const L = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001';
const F = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';

const i18n = { t: jest.fn((key: string) => key) };
const settings = { uploadLimits: jest.fn(async () => ({ photoMaxMb: 8, attachmentMaxMb: 5 })) };

function makeStorage() {
  return {
    publicBaseUrl: BASE,
    put: jest.fn(async () => undefined),
    deletePrefix: jest.fn(async () => 0),
    deleteObject: jest.fn(async () => undefined),
    signedUrl: jest.fn(async (key: string) => `${BASE}-private/${key}?signature=x`),
  };
}

function file(buffer: Buffer, mimetype: string, originalname = 'photo.jpg'): Express.Multer.File {
  return { buffer, mimetype, originalname, size: buffer.length } as Express.Multer.File;
}

async function jpeg(width: number, height: number, orientation?: number) {
  const image = sharp({ create: { width, height, channels: 3, background: '#3366cc' } }).jpeg();
  return (orientation ? image.withMetadata({ orientation }) : image).toBuffer();
}

async function sizeOf(body: Buffer) {
  const { width, height, format } = await sharp(body).metadata();
  return { width, height, format };
}

describe('UploadsService#saveImage (T143)', () => {
  it('stores a listing photo as its four widths and a master, under a new folder of the listing', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    const key = await service.saveImage(file(await jpeg(3000, 2000), 'image/jpeg'), { kind: 'listingPhoto', listingId: L });

    expect(key).toMatch(new RegExp(`^listings/${L}/photos/[0-9a-f-]{36}$`));
    const puts = storage.put.mock.calls as unknown as Array<[string, string, Buffer, { contentType: string; cacheControl: string }]>;
    expect(puts.map(([bucket, objectKey]) => [bucket, objectKey.slice(key.length + 1)])).toEqual([
      ['public', '400.webp'],
      ['public', '800.webp'],
      ['public', '1280.webp'],
      ['public', '1920.webp'],
      ['public', 'master.webp'],
    ]);
    expect(puts[0][3]).toEqual({ contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' });
    expect(await sizeOf(puts[0][2])).toEqual({ width: 400, height: 267, format: 'webp' });
    expect(await sizeOf(puts[3][2])).toEqual({ width: 1920, height: 1280, format: 'webp' });
    expect(await sizeOf(puts[4][2])).toEqual({ width: 2560, height: 1707, format: 'webp' });
  });

  it('turns a photo the way its EXIF says and keeps no EXIF', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    await service.saveImage(file(await jpeg(3000, 2000, 6), 'image/jpeg'), { kind: 'listingPhoto', listingId: L });

    const master = (storage.put.mock.calls as any[]).find(([, objectKey]) => objectKey.endsWith('master.webp'))[2];
    expect(await sizeOf(master)).toEqual({ width: 1707, height: 2560, format: 'webp' });
    expect((await sharp(master).metadata()).exif).toBeUndefined();
  });

  it('never enlarges a small photo: a width above its own size holds it as it is', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    await service.saveImage(file(await jpeg(600, 400), 'image/jpeg'), { kind: 'listingPhoto', listingId: L });

    const byName = new Map((storage.put.mock.calls as any[]).map(([, objectKey, body]) => [objectKey.split('/').pop(), body]));
    expect(await sizeOf(byName.get('400.webp'))).toMatchObject({ width: 400 });
    expect(await sizeOf(byName.get('1920.webp'))).toMatchObject({ width: 600, height: 400 });
  });

  it('fits an avatar into its square sizes and keeps no master', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    const key = await service.saveImage(file(await jpeg(1000, 500), 'image/jpeg'), { kind: 'avatar', userId: L });

    expect(key).toMatch(new RegExp(`^users/${L}/avatar/[0-9a-f-]{36}$`));
    const calls = storage.put.mock.calls as any[];
    expect(calls.map(([, objectKey]) => objectKey.split('/').pop())).toEqual(['128.webp', '400.webp']);
    expect(await sizeOf(calls[0][2])).toMatchObject({ width: 128, height: 64 });
    expect(await sizeOf(calls[1][2])).toMatchObject({ width: 400, height: 200 });
  });

  it('refuses a wrong type, a file over the limit and a file that is no picture, storing nothing', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);
    const target = { kind: 'listingPhoto' as const, listingId: L };

    await expect(service.saveImage(file(Buffer.from('GIF89a'), 'image/gif'), target)).rejects.toThrow('errors.IMAGE_TYPE_NOT_ALLOWED');
    const big = file(Buffer.alloc(10), 'image/jpeg');
    big.size = 8 * 1024 * 1024 + 1;
    await expect(service.saveImage(big, target)).rejects.toThrow('errors.IMAGE_TOO_LARGE');
    await expect(service.saveImage(file(Buffer.from('<html>'), 'image/png'), target)).rejects.toThrow('errors.IMAGE_INVALID');
    await expect(service.saveImage(undefined, target)).rejects.toThrow('errors.FILE_REQUIRED');
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('holds a photo to the limit set in Administracija > Skladište', async () => {
    const storage = makeStorage();
    const limits = { uploadLimits: jest.fn(async () => ({ photoMaxMb: 2, attachmentMaxMb: 5 })) };
    const service = new UploadsService(i18n as any, storage as any, limits as any);
    const big = file(Buffer.alloc(10), 'image/jpeg');
    big.size = 2 * 1024 * 1024 + 1;

    await expect(service.saveImage(big, { kind: 'listingPhoto', listingId: L })).rejects.toThrow('errors.IMAGE_TOO_LARGE');
    expect(i18n.t).toHaveBeenLastCalledWith('errors.IMAGE_TOO_LARGE', { args: { max: 2 } });
  });

  it('takes back the files already written when one of them fails', async () => {
    const storage = makeStorage();
    storage.put.mockImplementationOnce(async () => undefined).mockImplementationOnce(async () => {
      throw new Error('network');
    });
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    await expect(
      service.saveImage(file(await jpeg(800, 600), 'image/jpeg'), { kind: 'categoryImage', categoryId: L }),
    ).rejects.toThrow('network');
    expect(storage.deletePrefix).toHaveBeenCalledWith('public', expect.stringMatching(new RegExp(`^categories/${L}/[0-9a-f-]{36}/$`)));
  });
});

describe('UploadsService#saveAttachment (T143, R85)', () => {
  const place = { conversationId: L, messageId: F, attachmentId: L };

  it('keeps a PDF as it is, private, under its conversation and message', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);
    const pdf = Buffer.from('%PDF-1.7\n...');

    const saved = await service.saveAttachment(file(pdf, 'application/pdf', 'Ugovor.pdf'), place);

    expect(saved).toEqual({ key: `conversations/${L}/${F}/${L}.pdf`, contentType: 'application/pdf' });
    expect(storage.put).toHaveBeenCalledWith('private', saved.key, pdf, {
      contentType: 'application/pdf',
      cacheControl: 'private, max-age=3600',
      contentDisposition: `inline; filename="Ugovor.pdf"; filename*=UTF-8''Ugovor.pdf`,
    });
  });

  it('stores a picture as WebP and refuses a page that only calls itself a PDF', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    const saved = await service.saveAttachment(file(await jpeg(2400, 1600), 'image/jpeg', 'soba.jpg'), place);
    expect(saved).toEqual({ key: `conversations/${L}/${F}/${L}.webp`, contentType: 'image/webp' });
    expect(await sizeOf((storage.put.mock.calls as any[])[0][2])).toEqual({ width: 1600, height: 1067, format: 'webp' });

    await expect(
      service.saveAttachment(file(Buffer.from('<script>alert(1)</script>'), 'application/pdf', 'x.pdf'), place),
    ).rejects.toThrow('errors.ATTACHMENT_INVALID');
    await expect(service.saveAttachment(file(Buffer.from('x'), 'text/html', 'x.html'), place)).rejects.toThrow(
      'errors.ATTACHMENT_TYPE_NOT_ALLOWED',
    );
    const big = file(Buffer.from('%PDF-'), 'application/pdf');
    big.size = 5 * 1024 * 1024 + 1;
    await expect(service.saveAttachment(big, place)).rejects.toThrow('errors.ATTACHMENT_TOO_LARGE');
  });

  it('hands out a signed link for a stored attachment and leaves an old address alone', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);
    const key = `conversations/${L}/${F}/${L}.pdf`;

    expect(await service.attachmentUrl(key)).toBe(`${BASE}-private/${key}?signature=x`);
    expect(await service.attachmentUrl('http://localhost:3001/uploads/messages/a.pdf')).toBe(
      'http://localhost:3001/uploads/messages/a.pdf',
    );
  });
});

describe('UploadsService#removeImage (T143)', () => {
  it('deletes the folder of a key or of one of our own URLs, and nothing else', async () => {
    const storage = makeStorage();
    const service = new UploadsService(i18n as any, storage as any, settings as any);
    const key = `users/${L}/avatar/${F}`;

    await service.removeImage(key);
    await service.removeImage(`${BASE}/${key}/400.webp`);
    await service.removeImage('https://lh3.googleusercontent.com/a/photo');
    await service.removeImage(null);

    expect(storage.deletePrefix.mock.calls).toEqual([
      ['public', `${key}/`],
      ['public', `${key}/`],
    ]);
  });

  it('only logs a failed delete; the record has already let the picture go', async () => {
    const storage = makeStorage();
    storage.deletePrefix.mockRejectedValueOnce(new Error('network'));
    const service = new UploadsService(i18n as any, storage as any, settings as any);

    await expect(service.removeImage(`users/${L}/avatar/${F}`)).resolves.toBeUndefined();
  });
});

describe('uploadedFileName', () => {
  it('reads the name multer took for Latin-1 as the UTF-8 the browser sent', () => {
    const garbled = Buffer.from('Ugovor čćžšđ.pdf', 'utf8').toString('latin1');
    expect(uploadedFileName(garbled)).toBe('Ugovor čćžšđ.pdf');
    expect(uploadedFileName('Ugovor čćžšđ.pdf')).toBe('Ugovor čćžšđ.pdf');
    expect(uploadedFileName('plain.pdf')).toBe('plain.pdf');
    expect(uploadedFileName('Café.pdf')).toBe('Café.pdf');
  });
});

describe('inlineDisposition', () => {
  it('names the file by what is stored, ASCII for old browsers and UTF-8 for the rest', () => {
    expect(inlineDisposition('Račun za maj (konačan).JPG', 'webp')).toBe(
      `inline; filename="Racun za maj (konacan).webp"; filename*=UTF-8''Ra%C4%8Dun%20za%20maj%20%28kona%C4%8Dan%29.webp`,
    );
    expect(inlineDisposition('"; evil', 'pdf')).toBe(`inline; filename="; evil.pdf"; filename*=UTF-8''%3B%20evil.pdf`);
    expect(inlineDisposition('', 'pdf')).toBe(`inline; filename="prilog.pdf"; filename*=UTF-8''prilog.pdf`);
  });
});

it('BadRequestException is what a refused upload throws', async () => {
  const service = new UploadsService(i18n as any, makeStorage() as any, settings as any);
  await expect(service.saveImage(undefined, { kind: 'homepagePoster' })).rejects.toBeInstanceOf(BadRequestException);
});
