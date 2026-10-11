import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3StorageDriver } from './s3-storage.driver';

const settings = {
  endpoint: 'https://fsn1.your-objectstorage.com',
  region: 'fsn1',
  accessKeyId: 'TESTKEY',
  secretAccessKey: 'testsecret',
  publicBucket: 'rentaj-test-media',
  privateBucket: 'rentaj-test-private',
  forcePathStyle: false,
};
const KEY = 'conversations/0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001/7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10/5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f.pdf';

describe('S3StorageDriver (T143, Hetzner)', () => {
  it('signs a private link on the bucket host, the same for the same signing time', async () => {
    const driver = new S3StorageDriver(settings);
    const signedAt = new Date('2026-10-11T10:00:00Z');

    const url = new URL(await driver.signedUrl(KEY, signedAt, 7200));
    const again = await driver.signedUrl(KEY, signedAt, 7200);

    expect(url.host).toBe('rentaj-test-private.fsn1.your-objectstorage.com');
    expect(url.pathname).toBe(`/${KEY}`);
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261011T100000Z');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('7200');
    expect(url.searchParams.get('X-Amz-Credential')).toBe('TESTKEY/20261011/fsn1/s3/aws4_request');
    // A browser opening the link sends no extra headers, so none may be signed in.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.has('x-amz-checksum-mode')).toBe(false);
    expect(again).toBe(url.toString());
  });

  it('puts a public file into the public bucket with its type and caching', async () => {
    const driver = new S3StorageDriver(settings);
    const send = jest.spyOn((driver as any).client, 'send').mockResolvedValue({} as never);

    await driver.put('public', 'listings/x/photos/y/400.webp', Buffer.from('w'), {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'rentaj-test-media',
      Key: 'listings/x/photos/y/400.webp',
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });
});
