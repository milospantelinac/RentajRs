import { BadRequestException, ConflictException, HttpStatus, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { VIDEO_DISK_RESERVE_BYTES, VideoStorageService } from './video-storage.service';

const ADMIN = 'a0000000-0000-4000-8000-000000000001';
const OTHER_ADMIN = 'a0000000-0000-4000-8000-000000000002';

function box(type: string, ...children: Buffer[]): Buffer {
  const body = Buffer.concat(children);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, body]);
}

/** ftyp, a large mdat and moov last, as many exporters write it; H.264 video and AAC sound. */
function mp4(mdatBytes = 300_000): Buffer {
  const track = (codec: string) => {
    const entries = Buffer.alloc(8);
    entries.writeUInt32BE(1, 4);
    return box('trak', box('mdia', box('minf', box('stbl', box('stsd', entries, box(codec, Buffer.alloc(16)))))));
  };
  return Buffer.concat([
    box('ftyp', Buffer.from('isom\0\0\x02\0isomavc1', 'latin1')),
    box('mdat', Buffer.alloc(mdatBytes, 3)),
    box('moov', box('mvhd', Buffer.alloc(100)), track('avc1'), track('mp4a')),
  ]);
}

const body = (bytes: Buffer) => Readable.from([bytes]);

describe('VideoStorageService (videos on this server, uploaded in parts)', () => {
  let root: string;
  let service: VideoStorageService;
  const video = mp4();

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rentaj-videos-'));
    const config = { get: (key: string) => (key === 'videos.dir' ? path.join(root, 'videos') : undefined) };
    const i18n = { t: (key: string) => key };
    service = new VideoStorageService(config as any, i18n as any);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function sendAll(id: string, bytes: Buffer, partSize: number) {
    let offset = 0;
    while (offset < bytes.length) {
      const part = bytes.subarray(offset, offset + partSize);
      const progress = await service.writeChunk(ADMIN, id, offset, body(part), part.length);
      offset = progress.received;
    }
    return offset;
  }

  it('takes a video in parts, then moves it to a name of its own and says what it is', async () => {
    const started = await service.start(ADMIN, { fileName: 'Rentaj vodič.mp4', size: video.length, lastModified: 1 });
    expect(started.received).toBe(0);

    expect(await sendAll(started.id, video, 64 * 1024)).toBe(video.length);
    const stored = await service.complete(ADMIN, started.id);

    expect(stored).toMatchObject({ name: 'Rentaj vodič.mp4', size: video.length, type: 'video/mp4' });
    expect(stored.file).toMatch(/^[0-9a-f-]{36}\.mp4$/);
    expect(stored.codecs.sort()).toEqual(['avc1', 'mp4a']);
    const kept = await fs.readFile(service.pathOf(stored.file)!);
    expect(kept.equals(video)).toBe(true);
    // Nothing of the upload is left behind.
    expect(await fs.readdir(path.join(root, 'videos', '.incoming'))).toEqual([]);
    await expect(service.status(ADMIN, started.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces a part sent again after its answer was lost, and refuses one sent ahead of what it has', async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    await service.writeChunk(ADMIN, id, 0, body(video.subarray(0, 1000)));
    await service.writeChunk(ADMIN, id, 1000, body(video.subarray(1000, 2000)));
    // The same second part again: stored once.
    expect((await service.writeChunk(ADMIN, id, 1000, body(video.subarray(1000, 2000)))).received).toBe(2000);

    const ahead = await service.writeChunk(ADMIN, id, 5000, body(video.subarray(5000, 6000))).catch((error) => error);
    expect(ahead).toBeInstanceOf(ConflictException);
    expect(ahead.getResponse()).toMatchObject({ received: 2000 });

    await service.writeChunk(ADMIN, id, 2000, body(video.subarray(2000)));
    const stored = await service.complete(ADMIN, id);
    expect((await fs.readFile(service.pathOf(stored.file)!)).equals(video)).toBe(true);
  });

  it('keeps what arrived of a part when the browser goes away, so the upload carries on from there', async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    const interrupted = new Readable({ read() {} });
    const writing = service.writeChunk(ADMIN, id, 0, interrupted);
    interrupted.push(video.subarray(0, 5000));
    await new Promise((resolve) => setTimeout(resolve, 20));
    interrupted.destroy(Object.assign(new Error('aborted'), { code: 'ECONNRESET' }));
    await expect(writing).rejects.toBeInstanceOf(BadRequestException);

    const { received } = await service.status(ADMIN, id);
    expect(received).toBe(5000);
    await service.writeChunk(ADMIN, id, received, body(video.subarray(received)));
    const stored = await service.complete(ADMIN, id);
    expect((await fs.readFile(service.pathOf(stored.file)!)).equals(video)).toBe(true);
  });

  it('refuses a file that is not a video as soon as its first part is in, and forgets the upload', async () => {
    const page = Buffer.from('<!doctype html><html><body>' + 'x'.repeat(2000));
    const { id } = await service.start(ADMIN, { fileName: 'video.mp4', size: page.length });
    const refused = await service.writeChunk(ADMIN, id, 0, body(page.subarray(0, 1000))).catch((error) => error);
    expect(refused).toBeInstanceOf(BadRequestException);
    expect(refused.message).toBe('errors.VIDEO_TYPE_NOT_ALLOWED');
    await expect(service.status(ADMIN, id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses more bytes than the file has, and a part larger than one request may carry', async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: 3000 });
    const tooMuch = await service.writeChunk(ADMIN, id, 0, body(Buffer.concat([video.subarray(0, 3000), Buffer.alloc(10)]))).catch((e) => e);
    expect(tooMuch).toBeInstanceOf(BadRequestException);
    expect(tooMuch.message).toBe('errors.VIDEO_UPLOAD_TOO_MUCH');
    expect((await service.status(ADMIN, id)).received).toBe(0);

    jest.spyOn(service, 'freeBytes').mockResolvedValue(10 * VIDEO_DISK_RESERVE_BYTES);
    const big = await service.start(ADMIN, { fileName: 'big.mp4', size: 500 * 1024 * 1024 });
    const refused = await service.writeChunk(ADMIN, big.id, 0, body(Buffer.alloc(10)), 65 * 1024 * 1024).catch((e) => e);
    expect(refused.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  it('will not finish an upload that is not all there', async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    await service.writeChunk(ADMIN, id, 0, body(video.subarray(0, 1000)));
    const early = await service.complete(ADMIN, id).catch((error) => error);
    expect(early).toBeInstanceOf(ConflictException);
    expect(early.getResponse()).toMatchObject({ received: 1000 });
  });

  it('picks up the upload the same admin left for the same file, after a reload', async () => {
    const first = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length, lastModified: 42 });
    await service.writeChunk(ADMIN, first.id, 0, body(video.subarray(0, 4000)));
    const again = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length, lastModified: 42 });
    expect(again).toEqual({ id: first.id, received: 4000, size: video.length });
    // Another file, or another admin: a new upload.
    expect((await service.start(ADMIN, { fileName: 'a.mp4', size: video.length, lastModified: 43 })).id).not.toBe(first.id);
    expect((await service.start(OTHER_ADMIN, { fileName: 'a.mp4', size: video.length, lastModified: 42 })).id).not.toBe(first.id);
  });

  it("does not let one admin into another's upload", async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    await expect(service.status(OTHER_ADMIN, id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.writeChunk(OTHER_ADMIN, id, 0, body(video.subarray(0, 10)))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.status(ADMIN, 'not-an-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('takes parts one at a time: two sent together for the same place are stored once', async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    const part = video.subarray(0, 50_000);
    await Promise.all([service.writeChunk(ADMIN, id, 0, body(part)), service.writeChunk(ADMIN, id, 0, body(part))]);
    expect((await service.status(ADMIN, id)).received).toBe(50_000);
  });

  it('refuses a video the disk has no room for, keeping a reserve', async () => {
    jest.spyOn(service, 'freeBytes').mockResolvedValue(VIDEO_DISK_RESERVE_BYTES + 1000);
    const refused = await service.start(ADMIN, { fileName: 'a.mp4', size: 2000 }).catch((error) => error);
    expect(refused).toBeInstanceOf(BadRequestException);
    expect(refused.message).toBe('errors.VIDEO_NOT_ENOUGH_SPACE');
    await expect(service.start(ADMIN, { fileName: 'a.mp4', size: 900 })).resolves.toMatchObject({ received: 0 });
  });

  it('cancels an upload, and gives up one nothing was added to for a day', async () => {
    const cancelled = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    await service.cancel(ADMIN, cancelled.id);
    await expect(service.status(ADMIN, cancelled.id)).rejects.toBeInstanceOf(NotFoundException);

    const left = await service.start(ADMIN, { fileName: 'b.mp4', size: video.length });
    await service.writeChunk(ADMIN, left.id, 0, body(video.subarray(0, 100)));
    expect(await service.removeStale(Date.now() + 60 * 60_000)).toBe(0);
    expect(await service.removeStale(Date.now() + 25 * 60 * 60_000)).toBe(1);
    await expect(service.status(ADMIN, left.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a stored video, and only names it made itself', async () => {
    const { id } = await service.start(ADMIN, { fileName: 'a.mp4', size: video.length });
    await sendAll(id, video, video.length);
    const stored = await service.complete(ADMIN, id);
    await fs.writeFile(path.join(root, 'keep.txt'), 'x');

    await service.remove('../keep.txt');
    await service.remove(stored.file);
    await expect(fs.access(service.pathOf(stored.file)!)).rejects.toThrow();
    await expect(fs.access(path.join(root, 'keep.txt'))).resolves.toBeUndefined();
    expect(service.pathOf('../keep.txt')).toBeNull();
    expect(service.pathOf('.incoming')).toBeNull();
  });
});
