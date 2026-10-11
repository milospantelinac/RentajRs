import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageDriver } from './s3-storage.driver';
import { LocalStorageDriver } from './local-storage.driver';

export type BucketName = 'public' | 'private';

export interface StoredObject {
  key: string;
  lastModified: Date;
  size: number;
}

export interface PutOptions {
  contentType: string;
  cacheControl: string;
  contentDisposition?: string;
}

/** One place files can be kept: Object Storage on the server, the disk on a developer's machine. */
export interface StorageDriver {
  put(bucket: BucketName, key: string, body: Buffer, options: PutOptions): Promise<void>;
  getBytes(bucket: BucketName, key: string): Promise<Buffer>;
  deleteObject(bucket: BucketName, key: string): Promise<void>;
  list(bucket: BucketName, prefix: string): AsyncGenerator<StoredObject>;
  /** A link to a private file, valid from signingDate for expiresIn seconds. */
  signedUrl(key: string, signingDate: Date, expiresIn: number): Promise<string>;
  /** Whether a bucket keeps deleted files as older versions; null where that means nothing (the disk). */
  versioning(bucket: BucketName): Promise<string | null>;
}

export interface StorageConfig {
  driver: 'local' | 's3';
  publicBaseUrl: string;
  localDir: string;
  linkSecret: string;
  s3: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBucket: string;
    privateBucket: string;
    forcePathStyle: boolean;
  };
}

// A signed link to a private file is the same for a whole hour: the
// conversation page reloads its messages every 30 seconds, and a new link each
// time would download every picture in it again. It stays valid for at least
// another hour after that.
const SIGNING_WINDOW_MS = 60 * 60_000;
const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;

const DELETE_CONCURRENCY = 8;

/**
 * T143: where uploaded files are kept. On the server (STORAGE_DRIVER=s3) that
 * is Object Storage, Hetzner's; on a developer's machine (the default) it is
 * the disk under UPLOADS_DIR, served by this backend, so pages with pictures
 * can be built and tried without a bucket. Both keep the same keys (media.ts)
 * in two places: public pictures anyone may read by URL, and private files
 * that are only handed out as short-lived signed links.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly settings: StorageConfig;
  private readonly driver: StorageDriver;

  constructor(config: ConfigService) {
    this.settings = config.get<StorageConfig>('storage')!;
    if (this.settings.driver === 's3') {
      // A server set to Object Storage but missing a value stops at start, not at the first upload.
      const s3 = this.settings.s3;
      const missing = Object.entries({
        S3_ENDPOINT: s3.endpoint,
        S3_ACCESS_KEY_ID: s3.accessKeyId,
        S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
        S3_PUBLIC_BUCKET: s3.publicBucket,
        S3_PRIVATE_BUCKET: s3.privateBucket,
      })
        .filter(([, value]) => !value)
        .map(([name]) => name);
      if (missing.length) throw new Error(`STORAGE_DRIVER=s3 needs ${missing.join(', ')}`);
      this.driver = new S3StorageDriver(s3);
      this.logger.log(`Files go to Object Storage (${this.settings.s3.endpoint}), read from ${this.publicBaseUrl}`);
    } else {
      this.driver = new LocalStorageDriver(this.settings.localDir, this.settings.publicBaseUrl, this.settings.linkSecret);
      this.logger.log(`Files go to the local disk (${this.settings.localDir}), read from ${this.publicBaseUrl}`);
    }
  }

  get driverName(): 'local' | 's3' {
    return this.settings.driver;
  }

  /** Base of every public file's URL, without a trailing slash. */
  get publicBaseUrl(): string {
    return this.settings.publicBaseUrl;
  }

  put(bucket: BucketName, key: string, body: Buffer, options: PutOptions): Promise<void> {
    return this.driver.put(bucket, key, body, options);
  }

  getBytes(bucket: BucketName, key: string): Promise<Buffer> {
    return this.driver.getBytes(bucket, key);
  }

  deleteObject(bucket: BucketName, key: string): Promise<void> {
    return this.driver.deleteObject(bucket, key);
  }

  /** Deletes the given objects, a few at a time. */
  async deleteObjects(bucket: BucketName, keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += DELETE_CONCURRENCY) {
      await Promise.all(keys.slice(i, i + DELETE_CONCURRENCY).map((key) => this.driver.deleteObject(bucket, key)));
    }
  }

  /** Deletes everything under a folder; returns how many objects went. */
  async deletePrefix(bucket: BucketName, prefix: string): Promise<number> {
    if (!prefix.endsWith('/')) throw new Error(`Refusing to delete a prefix that is not a folder: "${prefix}"`);
    const keys: string[] = [];
    for await (const object of this.driver.list(bucket, prefix)) keys.push(object.key);
    await this.deleteObjects(bucket, keys);
    return keys.length;
  }

  list(bucket: BucketName, prefix: string): AsyncGenerator<StoredObject> {
    return this.driver.list(bucket, prefix);
  }

  /** A link that opens one private file for an hour or two. */
  signedUrl(key: string, now = Date.now()): Promise<string> {
    const signingDate = new Date(Math.floor(now / SIGNING_WINDOW_MS) * SIGNING_WINDOW_MS);
    return this.driver.signedUrl(key, signingDate, SIGNED_URL_TTL_SECONDS);
  }

  versioning(bucket: BucketName): Promise<string | null> {
    return this.driver.versioning(bucket);
  }

  /** What Administracija > Skladište shows of the connection: never the secret, the access key only by its end. */
  describe() {
    const s3 = this.settings.s3;
    if (this.settings.driver === 'local') {
      return { driver: 'local' as const, publicBaseUrl: this.publicBaseUrl, localDir: this.settings.localDir };
    }
    return {
      driver: 's3' as const,
      publicBaseUrl: this.publicBaseUrl,
      endpoint: s3.endpoint,
      region: s3.region,
      publicBucket: s3.publicBucket,
      privateBucket: s3.privateBucket,
      forcePathStyle: s3.forcePathStyle,
      accessKey: `****${s3.accessKeyId.slice(-4)}`,
    };
  }

  /** The local driver, for the route that serves its private files; null on the server. */
  get localDriver(): LocalStorageDriver | null {
    return this.driver instanceof LocalStorageDriver ? this.driver : null;
  }
}
