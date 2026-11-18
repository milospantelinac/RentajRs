import * as fs from 'fs/promises';

/**
 * Videos an admin uploads (the homepage guide video) live on this server's
 * disk, never in Object Storage: UPLOADS_DIR/videos/{fileId}.mp4 or .webm, a random
 * name that is never reused, so a browser may keep one for a year. What is
 * accepted is decided from the file's own bytes, never from its name or the
 * type the browser guessed.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** A stored video's file name: what the setting holds and what /videos/ serves. */
export const VIDEO_FILE_NAME = new RegExp(`^${UUID}\\.(mp4|webm)$`);

export type VideoExtension = 'mp4' | 'webm';

export interface VideoContainer {
  extension: VideoExtension;
  contentType: 'video/mp4' | 'video/webm';
}

/** Bytes enough to tell the container from the start of a file. */
export const VIDEO_HEAD_BYTES = 64;

/**
 * The container the first bytes of a file belong to, or null when browsers
 * would not play it. MP4 and everything built on it (M4V, MOV, 3GP) opens
 * with an "ftyp" box; WebM is EBML with "webm" as its DocType. Matroska
 * (.mkv) is EBML too but is refused: browsers only play its WebM subset.
 */
export function videoContainerOf(head: Buffer): VideoContainer | null {
  if (head.length >= 12 && head.toString('latin1', 4, 8) === 'ftyp') {
    return { extension: 'mp4', contentType: 'video/mp4' };
  }
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3 && head.includes('webm', 0, 'latin1')) {
    return { extension: 'webm', contentType: 'video/webm' };
  }
  return null;
}

/** Codec names (sample entry types) that are video, not sound. */
const VIDEO_CODECS = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'dvh1', 'dvhe', 'av01', 'vp08', 'vp09', 'mp4v', 'encv']);
// H.264: the one video codec every browser plays from an MP4.
const UNIVERSAL_VIDEO_CODECS = new Set(['avc1', 'avc3']);

/** Whether a video stream in an MP4 needs a warning: anything but H.264 leaves some browsers with a black frame. */
export function needsCodecWarning(codecs: string[]): boolean {
  const video = codecs.filter((codec) => VIDEO_CODECS.has(codec));
  return video.length > 0 && !video.some((codec) => UNIVERSAL_VIDEO_CODECS.has(codec));
}

// moov holds the sample tables, a few hundred KB for a long film; anything
// far larger is not read.
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

/**
 * The codecs of an MP4's tracks (H.264 is "avc1", HEVC "hvc1", AAC sound
 * "mp4a"), read from the sample descriptions in its moov box, wherever in the
 * file that box is. Best effort: a file it cannot read gives an empty list.
 */
export async function mp4Codecs(file: string): Promise<string[]> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(file, 'r');
    const { size } = await handle.stat();
    const moov = await findTopLevelBox(handle, size, 'moov');
    if (!moov || moov.contentSize > MAX_MOOV_BYTES) return [];
    const body = Buffer.alloc(moov.contentSize);
    await handle.read(body, 0, body.length, moov.contentStart);
    const codecs = new Set<string>();
    collectSampleEntries(body, 0, body.length, codecs);
    return [...codecs];
  } catch {
    return [];
  } finally {
    await handle?.close();
  }
}

interface BoxPosition {
  contentStart: number;
  contentSize: number;
}

async function findTopLevelBox(handle: fs.FileHandle, fileSize: number, wanted: string): Promise<BoxPosition | null> {
  const header = Buffer.alloc(16);
  let position = 0;
  // A real file has a handful of top-level boxes (ftyp, free, mdat, moov).
  for (let boxes = 0; boxes < 1000 && position + 8 <= fileSize; boxes += 1) {
    const { bytesRead } = await handle.read(header, 0, 16, position);
    if (bytesRead < 8) return null;
    let size = header.readUInt32BE(0);
    const type = header.toString('latin1', 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (bytesRead < 16) return null;
      size = Number(header.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      size = fileSize - position;
    }
    if (size < headerSize || position + size > fileSize) return null;
    if (type === wanted) return { contentStart: position + headerSize, contentSize: size - headerSize };
    position += size;
  }
  return null;
}

// The boxes between moov and a track's sample descriptions.
const PATH_TO_STSD = new Set(['trak', 'mdia', 'minf', 'stbl']);

function collectSampleEntries(buffer: Buffer, start: number, end: number, codecs: Set<string>, depth = 0) {
  if (depth > 8) return;
  let position = start;
  while (position + 8 <= end) {
    let size = buffer.readUInt32BE(position);
    const type = buffer.toString('latin1', position + 4, position + 8);
    let headerSize = 8;
    if (size === 1) {
      if (position + 16 > end) return;
      size = Number(buffer.readBigUInt64BE(position + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - position;
    }
    if (size < headerSize || position + size > end) return;
    if (PATH_TO_STSD.has(type)) {
      collectSampleEntries(buffer, position + headerSize, position + size, codecs, depth + 1);
    } else if (type === 'stsd') {
      // version and flags (4), entry count (4), then one box per sample entry, named after its codec.
      let entry = position + headerSize + 8;
      const stop = position + size;
      while (entry + 8 <= stop) {
        const entrySize = buffer.readUInt32BE(entry);
        codecs.add(buffer.toString('latin1', entry + 4, entry + 8));
        if (entrySize < 8) break;
        entry += entrySize;
      }
    }
    position += size;
  }
}
