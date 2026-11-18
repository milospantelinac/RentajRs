import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { VIDEO_FILE_NAME, mp4Codecs, needsCodecWarning, videoContainerOf } from './site-video';

/** An MP4 box: size, type, body. */
function box(type: string, ...children: Buffer[]): Buffer {
  const body = Buffer.concat(children);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, body]);
}

function track(codec: string): Buffer {
  const entries = Buffer.alloc(8);
  entries.writeUInt32BE(1, 4);
  const stsd = box('stsd', entries, box(codec, Buffer.alloc(16)));
  return box('trak', box('tkhd', Buffer.alloc(84)), box('mdia', box('mdhd', Buffer.alloc(24)), box('minf', box('stbl', stsd))));
}

/** A small but well-formed MP4: ftyp, then mdat and moov in either order. */
function mp4(videoCodec = 'avc1', moovFirst = false): Buffer {
  const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2avc1mp41', 'latin1'));
  const moov = box('moov', box('mvhd', Buffer.alloc(100)), track(videoCodec), track('mp4a'));
  const mdat = box('mdat', Buffer.alloc(4096, 7));
  return Buffer.concat(moovFirst ? [ftyp, moov, mdat] : [ftyp, mdat, moov]);
}

const WEBM_HEAD = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]),
  Buffer.from('webm', 'latin1'),
  Buffer.alloc(32),
]);

describe('site videos: what is accepted', () => {
  it('knows an MP4 (and MOV, M4V) by its ftyp box and a WebM by its EBML DocType', () => {
    expect(videoContainerOf(mp4())).toEqual({ extension: 'mp4', contentType: 'video/mp4' });
    expect(videoContainerOf(Buffer.concat([box('ftyp', Buffer.from('qt  \0\0\0\0qt  ', 'latin1'))]))).toEqual({
      extension: 'mp4',
      contentType: 'video/mp4',
    });
    expect(videoContainerOf(WEBM_HEAD)).toEqual({ extension: 'webm', contentType: 'video/webm' });
  });

  it('refuses Matroska, pictures, text and a file too short to tell', () => {
    const matroska = Buffer.concat([WEBM_HEAD.subarray(0, 12), Buffer.from('matroska', 'latin1')]);
    expect(videoContainerOf(matroska)).toBeNull();
    expect(videoContainerOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]))).toBeNull();
    expect(videoContainerOf(Buffer.from('<html><body>not a video</body></html>'))).toBeNull();
    expect(videoContainerOf(Buffer.from([0, 0, 0, 24, 0x66]))).toBeNull();
  });

  it('serves only names it made itself', () => {
    expect(VIDEO_FILE_NAME.test('0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001.mp4')).toBe(true);
    expect(VIDEO_FILE_NAME.test('0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001.webm')).toBe(true);
    for (const name of ['../etc/passwd', '.incoming', 'x.mp4', '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001.part', '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001.mp4/']) {
      expect(VIDEO_FILE_NAME.test(name)).toBe(false);
    }
  });
});

describe('site videos: codecs of an MP4', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rentaj-video-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reads the tracks from moov at the end of the file and at its start', async () => {
    const end = path.join(dir, 'end.mp4');
    const start = path.join(dir, 'start.mp4');
    await fs.writeFile(end, mp4('avc1'));
    await fs.writeFile(start, mp4('hvc1', true));
    expect((await mp4Codecs(end)).sort()).toEqual(['avc1', 'mp4a']);
    expect((await mp4Codecs(start)).sort()).toEqual(['hvc1', 'mp4a']);
  });

  it('gives nothing for a file it cannot read, rather than failing the upload', async () => {
    const broken = path.join(dir, 'broken.mp4');
    await fs.writeFile(broken, Buffer.concat([mp4().subarray(0, 40), Buffer.from('cut short')]));
    expect(await mp4Codecs(broken)).toEqual([]);
    expect(await mp4Codecs(path.join(dir, 'missing.mp4'))).toEqual([]);
  });

  it('warns about a video every browser does not play: anything but H.264', () => {
    expect(needsCodecWarning(['avc1', 'mp4a'])).toBe(false);
    expect(needsCodecWarning(['hvc1', 'mp4a'])).toBe(true);
    expect(needsCodecWarning(['av01'])).toBe(true);
    // Sound only, or nothing read: nothing to say.
    expect(needsCodecWarning(['mp4a'])).toBe(false);
    expect(needsCodecWarning([])).toBe(false);
  });
});
