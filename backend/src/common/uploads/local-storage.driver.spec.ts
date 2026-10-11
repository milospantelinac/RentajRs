import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageDriver } from './local-storage.driver';

const C = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001';
const M = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';
const A = '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
const ATTACHMENT = `conversations/${C}/${M}/${A}.pdf`;
const PHOTO = `listings/${C}/photos/${M}`;

describe('LocalStorageDriver (T143, a developer machine without a bucket)', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rentaj-media-'));
    driver = new LocalStorageDriver(root, 'http://localhost:3001/media', 'secret');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('keeps public files under media/ and private ones under private/, by their keys', async () => {
    await driver.put('public', `${PHOTO}/400.webp`, Buffer.from('small'), { contentType: 'image/webp', cacheControl: 'x' });
    await driver.put('private', ATTACHMENT, Buffer.from('%PDF-1.4'), { contentType: 'application/pdf', cacheControl: 'x' });
    expect(await fs.readFile(path.join(root, 'media', ...PHOTO.split('/'), '400.webp'), 'utf8')).toBe('small');
    expect((await driver.getBytes('private', ATTACHMENT)).toString()).toBe('%PDF-1.4');
  });

  it('lists what is under a prefix (not the private files beside it) and deletes a folder', async () => {
    for (const name of ['400.webp', '800.webp']) {
      await driver.put('public', `${PHOTO}/${name}`, Buffer.from(name), { contentType: 'image/webp', cacheControl: 'x' });
    }
    await driver.put('public', `listings/${M}/photos/${A}/400.webp`, Buffer.from('other'), { contentType: 'image/webp', cacheControl: 'x' });

    const listed: string[] = [];
    for await (const object of driver.list('public', `listings/${C}/`)) listed.push(object.key);
    expect(listed.sort()).toEqual([`${PHOTO}/400.webp`, `${PHOTO}/800.webp`]);

    for (const key of listed) await driver.deleteObject('public', key);
    const after: string[] = [];
    for await (const object of driver.list('public', 'listings/')) after.push(object.key);
    expect(after).toEqual([`listings/${M}/photos/${A}/400.webp`]);
  });

  it('opens a private file only through its signed link, until the link runs out', async () => {
    await driver.put('private', ATTACHMENT, Buffer.from('%PDF-1.4'), {
      contentType: 'application/pdf',
      cacheControl: 'x',
      contentDisposition: 'inline; filename="ugovor.pdf"',
    });
    const signedAt = new Date('2026-10-11T10:00:00Z');
    const link = new URL(await driver.signedUrl(ATTACHMENT, signedAt, 7200));
    expect(link.origin + link.pathname).toBe(`http://localhost:3001/media-private/${ATTACHMENT}`);
    const expires = link.searchParams.get('expires');
    const signature = link.searchParams.get('signature');

    const opened = await driver.openSigned(ATTACHMENT, expires, signature, signedAt.getTime() + 60_000);
    expect(opened).toMatchObject({ contentType: 'application/pdf', contentDisposition: 'inline; filename="ugovor.pdf"' });
    expect(await driver.openSigned(ATTACHMENT, expires, signature, signedAt.getTime() + 7201_000)).toBeNull();
    expect(await driver.openSigned(ATTACHMENT, expires, 'f'.repeat(64), signedAt.getTime())).toBeNull();
    expect(await driver.openSigned(ATTACHMENT, Number(expires) + 3600, signature, signedAt.getTime())).toBeNull();
  });

  it('refuses a key that would leave its folder', async () => {
    await expect(
      driver.put('public', '../outside.txt', Buffer.from('x'), { contentType: 'text/plain', cacheControl: 'x' }),
    ).rejects.toThrow('outside the storage folder');
  });
});
