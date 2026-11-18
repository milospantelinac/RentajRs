import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { VIDEO_FILE_NAME, VIDEO_HEAD_BYTES, mp4Codecs, videoContainerOf } from './site-video';

/** The most one request may carry; the admin page sends 8 MB and less. */
export const MAX_VIDEO_CHUNK_BYTES = 64 * 1024 * 1024;

/** Left free on the disk after a video, for the database and everything else on it. */
export const VIDEO_DISK_RESERVE_BYTES = 1024 ** 3;

// An upload nothing has been added to for a day is given up.
const STALE_UPLOAD_MS = 24 * 60 * 60_000;

const INCOMING_FOLDER = '.incoming';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Bytes after which the container can be told (an MP4's "ftyp" box ends at 12).
const CONTAINER_CHECK_BYTES = 12;
// What a browser that went away mid-request leaves the stream with.
const INTERRUPTED_CODES = new Set(['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'ECONNABORTED', 'EPIPE']);

interface UploadSession {
  id: string;
  adminId: string;
  fileName: string;
  size: number;
  lastModified: number | null;
  createdAt: string;
}

export interface VideoUploadProgress {
  id: string;
  received: number;
  size: number;
}

/** A finished upload, as the setting that points at it keeps it. */
export interface StoredVideo {
  file: string;
  name: string;
  size: number;
  type: string;
  codecs: string[];
  uploadedAt: string;
}

class ChunkOverflow extends Error {}

/**
 * Videos an admin uploads, kept on this server's own disk (UPLOADS_DIR/videos, the
 * uploads volume on the server), never in Object Storage, and with no limit
 * on their size beyond the free space.
 *
 * A video comes in parts: the admin page sends one request per part (8 MB at
 * most), each appended at the offset it names to UPLOADS_DIR/videos/.incoming/{id}.part.
 * No proxy limit on a request's body (nginx's client_max_body_size,
 * Cloudflare's 100 MB) stops a large file, a dropped connection costs one
 * part, and the server answers how far it got, so the page carries on from
 * there (also after a reload, when the same file is picked again). The
 * finished file is checked by its bytes and moved to UPLOADS_DIR/videos/{fileId}.ext.
 */
@Injectable()
export class VideoStorageService {
  private readonly logger = new Logger(VideoStorageService.name);
  readonly dir: string;
  private readonly incomingDir: string;
  // One request at a time per upload; the next waits for the one before.
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    config: ConfigService,
    private i18n: I18nService,
  ) {
    this.dir = config.get<string>('videos.dir')!;
    this.incomingDir = path.join(this.dir, INCOMING_FOLDER);
  }

  /** The file a stored video's name stands for, or null for anything that is not one. */
  pathOf(file: string): string | null {
    return VIDEO_FILE_NAME.test(file) ? path.join(this.dir, file) : null;
  }

  /**
   * Opens an upload, or picks up the one the same admin left for the same
   * file (name, size and modification time), with what it already has.
   */
  async start(
    adminId: string,
    input: { fileName: string; size: number; lastModified?: number | null },
  ): Promise<VideoUploadProgress> {
    await fs.mkdir(this.incomingDir, { recursive: true });
    await this.removeStale();
    const fileName = input.fileName.trim();
    const lastModified = input.lastModified ?? null;

    for (const session of await this.sessions()) {
      if (
        session.adminId === adminId &&
        session.fileName === fileName &&
        session.size === input.size &&
        session.lastModified === lastModified
      ) {
        const received = await this.receivedOf(session.id);
        await this.checkFreeSpace(session.size - received);
        return { id: session.id, received, size: session.size };
      }
    }

    await this.checkFreeSpace(input.size);
    const session: UploadSession = {
      id: randomUUID(),
      adminId,
      fileName,
      size: input.size,
      lastModified,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(this.partPath(session.id), Buffer.alloc(0));
    await fs.writeFile(this.sessionPath(session.id), JSON.stringify(session));
    return { id: session.id, received: 0, size: session.size };
  }

  async status(adminId: string, id: string): Promise<VideoUploadProgress> {
    const session = await this.session(adminId, id);
    return { id, received: await this.receivedOf(id), size: session.size };
  }

  /**
   * Adds one part, read from the request as it arrives (never held in
   * memory), at `offset`. An offset behind what is stored is a part sent
   * again after its answer was lost: what was there from that offset is
   * replaced. One ahead of it is refused with how far the upload got.
   */
  async writeChunk(
    adminId: string,
    id: string,
    offset: number,
    body: Readable,
    declaredLength?: number,
  ): Promise<VideoUploadProgress> {
    await this.session(adminId, id);
    return this.exclusive(id, async () => {
      // Read again: the upload may have been cancelled while this part waited.
      const session = await this.session(adminId, id);
      const part = this.partPath(id);
      const received = await this.receivedOf(id);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new BadRequestException(this.t('VIDEO_UPLOAD_OFFSET'));
      if (offset > received) throw new ConflictException({ message: this.t('VIDEO_UPLOAD_OFFSET'), received });

      const room = Math.min(MAX_VIDEO_CHUNK_BYTES, session.size - offset);
      if (declaredLength !== undefined && declaredLength > room) throw this.overflow(declaredLength, session.size - offset);
      if (offset < received) await fs.truncate(part, offset);

      let written = 0;
      const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          written += chunk.length;
          if (written > room) callback(new ChunkOverflow());
          else callback(null, chunk);
        },
      });
      try {
        await pipeline(body, limit, createWriteStream(part, { flags: 'a' }));
      } catch (error) {
        if (error instanceof ChunkOverflow) {
          await fs.truncate(part, offset);
          throw this.overflow(written, session.size - offset);
        }
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOSPC') {
          await fs.truncate(part, offset).catch(() => undefined);
          throw new BadRequestException(this.t('VIDEO_NOT_ENOUGH_SPACE', { free: this.describeBytes(await this.freeBytes()) }));
        }
        // The browser went away mid-part: what arrived stays (it is the start
        // of the part), and the next status says how far it got.
        if (INTERRUPTED_CODES.has(code ?? '') || (error as Error).message === 'aborted') {
          throw new BadRequestException(this.t('VIDEO_UPLOAD_INTERRUPTED'));
        }
        throw error;
      }

      const total = offset + written;
      // Refused as soon as its first bytes are in, not after the whole file.
      if (offset < CONTAINER_CHECK_BYTES && total >= Math.min(CONTAINER_CHECK_BYTES, session.size)) {
        if (!videoContainerOf(await this.readHead(part))) {
          await this.discard(id);
          throw new BadRequestException(this.t('VIDEO_TYPE_NOT_ALLOWED'));
        }
      }
      return { id, received: total, size: session.size };
    });
  }

  /** Moves a fully received upload to its own name and says what it is. */
  async complete(adminId: string, id: string): Promise<StoredVideo> {
    await this.session(adminId, id);
    return this.exclusive(id, async () => {
      const session = await this.session(adminId, id);
      const received = await this.receivedOf(id);
      if (received !== session.size) {
        throw new ConflictException({ message: this.t('VIDEO_UPLOAD_INCOMPLETE'), received });
      }
      const part = this.partPath(id);
      const container = videoContainerOf(await this.readHead(part));
      if (!container) {
        await this.discard(id);
        throw new BadRequestException(this.t('VIDEO_TYPE_NOT_ALLOWED'));
      }
      const codecs = container.extension === 'mp4' ? await mp4Codecs(part) : [];
      const file = `${randomUUID()}.${container.extension}`;
      await fs.rename(part, path.join(this.dir, file));
      await fs.rm(this.sessionPath(id), { force: true });
      this.logger.log(`Video ${file} stored (${session.size} bytes, from "${session.fileName}")`);
      return {
        file,
        name: session.fileName,
        size: session.size,
        type: container.contentType,
        codecs,
        uploadedAt: new Date().toISOString(),
      };
    });
  }

  async cancel(adminId: string, id: string): Promise<void> {
    await this.session(adminId, id);
    await this.exclusive(id, () => this.discard(id));
  }

  /** Deletes a stored video (replaced or removed by an admin). */
  async remove(file: string): Promise<void> {
    const full = this.pathOf(file);
    if (full) await fs.rm(full, { force: true });
  }

  // A method of its own: the cron library calls a job with an argument of its own.
  @Cron('0 30 4 * * *')
  async removeStaleUploads(): Promise<void> {
    await this.removeStale(Date.now());
  }

  /** Uploads nothing has been added to for a day: given up, their parts deleted. */
  async removeStale(now = Date.now()): Promise<number> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.incomingDir);
    } catch {
      return 0;
    }
    const ids = new Set(entries.map((name) => name.split('.')[0]).filter((name) => UUID.test(name)));
    let removed = 0;
    for (const id of ids) {
      if (this.queues.has(id)) continue;
      const changed = await Promise.all(
        [this.partPath(id), this.sessionPath(id)].map((file) =>
          fs.stat(file).then((stat) => stat.mtimeMs, () => 0),
        ),
      );
      if (now - Math.max(...changed) < STALE_UPLOAD_MS) continue;
      await this.discard(id);
      removed += 1;
    }
    if (removed) this.logger.log(`Removed ${removed} unfinished video upload(s)`);
    return removed;
  }

  private async sessions(): Promise<UploadSession[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.incomingDir);
    } catch {
      return [];
    }
    const sessions: UploadSession[] = [];
    for (const name of entries) {
      if (!name.endsWith('.json') || !UUID.test(name.slice(0, -5))) continue;
      const session = await this.readSession(name.slice(0, -5));
      if (session) sessions.push(session);
    }
    return sessions;
  }

  private async session(adminId: string, id: string): Promise<UploadSession> {
    const session = UUID.test(id) ? await this.readSession(id) : null;
    // Another admin's upload is not there for this one.
    if (!session || session.adminId !== adminId) throw new NotFoundException(this.t('VIDEO_UPLOAD_NOT_FOUND'));
    return session;
  }

  private async readSession(id: string): Promise<UploadSession | null> {
    try {
      const session = JSON.parse(await fs.readFile(this.sessionPath(id), 'utf8')) as UploadSession;
      return session.id === id && Number.isSafeInteger(session.size) ? session : null;
    } catch {
      return null;
    }
  }

  private async receivedOf(id: string): Promise<number> {
    try {
      return (await fs.stat(this.partPath(id))).size;
    } catch {
      throw new NotFoundException(this.t('VIDEO_UPLOAD_NOT_FOUND'));
    }
  }

  private async readHead(file: string): Promise<Buffer> {
    const handle = await fs.open(file, 'r');
    try {
      const head = Buffer.alloc(VIDEO_HEAD_BYTES);
      const { bytesRead } = await handle.read(head, 0, VIDEO_HEAD_BYTES, 0);
      return head.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  private async discard(id: string): Promise<void> {
    await fs.rm(this.partPath(id), { force: true });
    await fs.rm(this.sessionPath(id), { force: true });
  }

  /** Refuses a video the disk has no room for, keeping a reserve for everything else. */
  private async checkFreeSpace(bytes: number): Promise<void> {
    const free = await this.freeBytes();
    if (bytes + VIDEO_DISK_RESERVE_BYTES > free) {
      throw new BadRequestException(this.t('VIDEO_NOT_ENOUGH_SPACE', { free: this.describeBytes(free) }));
    }
  }

  /** Free space on the disk the videos are on, as far as this process may use it. */
  async freeBytes(): Promise<number> {
    await fs.mkdir(this.incomingDir, { recursive: true });
    const stats = await fs.statfs(this.incomingDir);
    return Number(stats.bavail) * Number(stats.bsize);
  }

  private overflow(sent: number, remaining: number): HttpException {
    // More than the file has left: a client fault. More than one part may
    // carry: 413, which the page answers by sending smaller parts.
    if (sent > remaining) return new BadRequestException(this.t('VIDEO_UPLOAD_TOO_MUCH'));
    return new HttpException(
      { message: this.t('VIDEO_CHUNK_TOO_LARGE'), error: 'PayloadTooLarge' },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }

  private describeBytes(bytes: number): string {
    return bytes >= 1e9 ? `${Math.floor(bytes / 1e9)} GB` : `${Math.floor(bytes / 1e6)} MB`;
  }

  private exclusive<T>(id: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const run = previous.then(task, task);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(id, settled);
    void settled.then(() => {
      if (this.queues.get(id) === settled) this.queues.delete(id);
    });
    return run;
  }

  private t(key: string, args?: Record<string, unknown>): string {
    return this.i18n.t(`errors.${key}`, args ? { args } : undefined);
  }

  private partPath(id: string): string {
    return path.join(this.incomingDir, `${id}.part`);
  }

  private sessionPath(id: string): string {
    return path.join(this.incomingDir, `${id}.json`);
  }
}
