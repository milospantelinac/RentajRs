import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { BucketName, PutOptions, StorageConfig, StorageDriver, StoredObject } from './storage.service';

/**
 * T143: Object Storage through the S3 API (Hetzner on the server, endpoint
 * https://fsn1.your-objectstorage.com). The public bucket is set to "public"
 * in the Hetzner Console, so its files are read by URL without keys (listing
 * them stays refused); the private one is not.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly settings: StorageConfig['s3']) {
    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      forcePathStyle: settings.forcePathStyle,
      // Newer SDKs add checksum headers to every request by default, which
      // S3-compatible stores do not all accept; only send them where S3 requires one.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      // A store that stops answering fails the request (and the health check) instead of holding it.
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 60_000 },
    });
  }

  async put(bucket: BucketName, key: string, body: Buffer, options: PutOptions): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket(bucket),
        Key: key,
        Body: body,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
        ContentDisposition: options.contentDisposition,
      }),
    );
  }

  async getBytes(bucket: BucketName, key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket(bucket), Key: key }));
    return Buffer.from(await result.Body!.transformToByteArray());
  }

  // One object at a time: S3's batch delete needs a checksum header that not
  // every S3-compatible store accepts, and a folder holds at most five files.
  async deleteObject(bucket: BucketName, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket(bucket), Key: key }));
  }

  async *list(bucket: BucketName, prefix: string): AsyncGenerator<StoredObject> {
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket(bucket), Prefix: prefix, ContinuationToken: continuationToken }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) yield { key: object.Key, lastModified: object.LastModified ?? new Date(0), size: object.Size ?? 0 };
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  signedUrl(key: string, signingDate: Date, expiresIn: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket('private'), Key: key }), {
      expiresIn,
      signingDate,
    });
  }

  /** "Enabled", "Suspended", or "Off" for a bucket where it was never turned on. */
  async versioning(bucket: BucketName): Promise<string | null> {
    const result = await this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket(bucket) }));
    return result.Status ?? 'Off';
  }

  private bucket(bucket: BucketName): string {
    return bucket === 'public' ? this.settings.publicBucket : this.settings.privateBucket;
  }
}
