import { createHmac, timingSafeEqual } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { BucketName, PutOptions, StorageDriver, StoredObject } from './storage.service';

// What S3 would keep with a private file (its type and download name), kept beside it.
const META_SUFFIX = '.meta.json';

/**
 * T143: the disk standing in for Object Storage on a developer's machine
 * (STORAGE_DRIVER unset). Same keys and files as the buckets, under
 * UPLOADS_DIR/media (served at MEDIA_BASE_URL, /media/ of this backend) and
 * UPLOADS_DIR/private (only through a signed link to /media-private/, which
 * LocalMediaController checks), so a page with pictures works the same as on
 * the server without one.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly publicRoot: string;
  private readonly privateRoot: string;
  private readonly privateLinkBase: string;
  private readonly signingKey: Buffer;

  constructor(root: string, publicBaseUrl: string, secret: string) {
    this.publicRoot = path.join(root, 'media');
    this.privateRoot = path.join(root, 'private');
    this.privateLinkBase = `${new URL(publicBaseUrl).origin}/media-private`;
    this.signingKey = createHmac('sha256', secret).update('rentaj-local-media-links').digest();
  }

  async put(bucket: BucketName, key: string, body: Buffer, options: PutOptions): Promise<void> {
    const file = this.fileOf(bucket, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    if (bucket === 'private') {
      const meta = { contentType: options.contentType, contentDisposition: options.contentDisposition ?? null };
      await fs.writeFile(file + META_SUFFIX, JSON.stringify(meta));
    }
  }

  getBytes(bucket: BucketName, key: string): Promise<Buffer> {
    return fs.readFile(this.fileOf(bucket, key));
  }

  async deleteObject(bucket: BucketName, key: string): Promise<void> {
    const file = this.fileOf(bucket, key);
    await fs.rm(file, { force: true });
    await fs.rm(file + META_SUFFIX, { force: true });
    // An image's folder goes with its last file, as it does in a bucket.
    await fs.rmdir(path.dirname(file)).catch(() => undefined);
  }

  async *list(bucket: BucketName, prefix: string): AsyncGenerator<StoredObject> {
    const root = this.rootOf(bucket);
    const folder = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/')) : '';
    yield* this.walk(root, path.join(root, ...folder.split('/').filter(Boolean)), prefix);
  }

  async signedUrl(key: string, signingDate: Date, expiresIn: number): Promise<string> {
    const expires = Math.floor(signingDate.getTime() / 1000) + expiresIn;
    return `${this.privateLinkBase}/${key}?expires=${expires}&signature=${this.sign(key, expires)}`;
  }

  /** The private file a signed link opens, or null when the link is wrong or has run out. */
  async openSigned(key: string, expires: unknown, signature: unknown, now = Date.now()) {
    const expiresAt = Number(expires);
    if (!Number.isInteger(expiresAt) || expiresAt * 1000 < now || typeof signature !== 'string') return null;
    const expected = Buffer.from(this.sign(key, expiresAt));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const file = this.fileOf('private', key);
    try {
      const meta = JSON.parse(await fs.readFile(file + META_SUFFIX, 'utf8'));
      return { file, contentType: String(meta.contentType), contentDisposition: meta.contentDisposition as string | null };
    } catch {
      return null;
    }
  }

  async versioning(): Promise<string | null> {
    return null;
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.signingKey).update(`${key}\n${expires}`).digest('hex');
  }

  private async *walk(root: string, folder: string, prefix: string): AsyncGenerator<StoredObject> {
    let entries;
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        yield* this.walk(root, full, prefix);
        continue;
      }
      if (entry.name.endsWith(META_SUFFIX)) continue;
      const key = path.relative(root, full).split(path.sep).join('/');
      if (!key.startsWith(prefix)) continue;
      const stat = await fs.stat(full);
      yield { key, lastModified: stat.mtime, size: stat.size };
    }
  }

  private rootOf(bucket: BucketName): string {
    return bucket === 'public' ? this.publicRoot : this.privateRoot;
  }

  private fileOf(bucket: BucketName, key: string): string {
    const root = this.rootOf(bucket);
    const file = path.resolve(root, ...key.split('/'));
    // Keys come from media.ts; one that would leave the folder is refused all the same.
    if (!file.startsWith(root + path.sep)) throw new Error(`Key outside the storage folder: ${key}`);
    return file;
  }
}
