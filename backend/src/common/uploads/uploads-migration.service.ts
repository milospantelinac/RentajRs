import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { DERIVED_KEY_PREFIXES } from '../cache/derived-keys';
import { StorageService } from './storage.service';
import { IMAGE_PROFILES, ImageKind, attachmentKey, newImageKey } from './media';
import {
  DISPLAY_QUALITY,
  PRIVATE_CACHE_CONTROL,
  PUBLIC_CACHE_CONTROL,
  inlineDisposition,
  looksLikePdf,
  uploadedFileName,
} from './uploads.service';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// The old addresses were UPLOADS_BASE_URL + one of these; only the end is read.
const OLD_LISTING_PHOTO = new RegExp(`(?:^|/)listings/(${UUID})/(${UUID})\\.webp$`);
const OLD_AVATAR = new RegExp(`(?:^|/)avatars/(${UUID})\\.webp$`);
const OLD_CATEGORY_IMAGE = new RegExp(`(?:^|/)categories/(${UUID})\\.webp$`);
const OLD_POSTER = new RegExp(`(?:^|/)homepage/(${UUID})\\.webp$`);
const OLD_ATTACHMENT = new RegExp(`(?:^|/)messages/(${UUID}\\.[a-z0-9]{1,8})$`);

export type MigrationType = 'listingPhoto' | 'avatar' | 'categoryImage' | 'homepagePoster' | 'attachment';
type Outcome = 'moved' | 'missing' | 'refused';

export interface MigrationReport {
  dryRun: boolean;
  counts: Array<{ type: MigrationType } & Record<Outcome, number>>;
  /** What was left and why (missing on disk, not a picture or a PDF), the first 100. */
  notes: string[];
}

export interface MigrationRun {
  dryRun: boolean;
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  startedById: string | null;
  report: MigrationReport | null;
  error: string | null;
}

/**
 * T143: moves the files uploaded before Object Storage (UPLOADS_DIR/listings,
 * avatars, categories, homepage and messages) to where StorageService keeps
 * files now, in the layout of media.ts, and points every record at its new
 * key. Run from Administracija > Skladište or src/scripts/migrate-uploads.ts;
 * a dry run only counts. Running it again is safe: a record already on a key
 * is skipped. The old files stay on disk. A listing photo keeps its old file
 * name as its new folder, which is how its old address finds the new file
 * (LegacyUploadsController).
 */
@Injectable()
export class UploadsMigrationService {
  private readonly logger = new Logger(UploadsMigrationService.name);
  private current: MigrationRun | null = null;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
    private cache: CacheService,
  ) {}

  /** Records still on an old /uploads/ address, per kind (database only, no files read). */
  async legacyCounts(): Promise<Record<MigrationType, number>> {
    const old = (folder: string) => ({ contains: `/uploads/${folder}/` });
    const [listingPhoto, avatar, categoryImage, poster, attachment] = await Promise.all([
      this.prisma.listingPhoto.count({ where: { url: old('listings') } }),
      this.prisma.user.count({ where: { avatarUrl: old('avatars') } }),
      this.prisma.category.count({ where: { imageUrl: old('categories') } }),
      this.prisma.setting.findUnique({ where: { key: 'homepage_video_thumbnail' } }),
      this.prisma.messageAttachment.count({ where: { url: old('messages') } }),
    ]);
    return {
      listingPhoto,
      avatar,
      categoryImage,
      homepagePoster: typeof poster?.value === 'string' && OLD_POSTER.test(poster.value) ? 1 : 0,
      attachment,
    };
  }

  /** The run started from the admin page (in this process), if any. */
  lastRun(): MigrationRun | null {
    return this.current;
  }

  isRunning(): boolean {
    return this.current?.status === 'running';
  }

  /** Starts a run in the background for the admin page; one at a time (the controller refuses a second first). */
  startFromAdmin(adminId: string, dryRun: boolean, onFinish?: (run: MigrationRun) => Promise<void>): MigrationRun {
    if (this.isRunning()) throw new Error('A migration is already running');
    const run: MigrationRun = {
      dryRun,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      startedById: adminId,
      report: null,
      error: null,
    };
    this.current = run;
    void this.migrate(dryRun)
      .then((report) => {
        run.report = report;
        run.status = 'done';
      })
      .catch((error) => {
        run.error = (error as Error).message;
        run.status = 'failed';
        this.logger.error(`Migration failed: ${run.error}`);
      })
      .finally(async () => {
        run.finishedAt = new Date().toISOString();
        await onFinish?.(run).catch(() => undefined);
      });
    return run;
  }

  async migrate(dryRun: boolean, log: (line: string) => void = () => undefined): Promise<MigrationReport> {
    const job = new Migration(this.prisma, this.storage, this.uploadsDir(), dryRun, log);
    await job.run();
    // Cached category data still holds the old addresses.
    if (!dryRun) for (const prefix of DERIVED_KEY_PREFIXES) await this.cache.delByPrefix(prefix);
    return job.report();
  }

  private uploadsDir(): string {
    return path.resolve(process.cwd(), this.config.get<string>('uploads.dir')!);
  }
}

class Migration {
  private readonly counts = new Map<MigrationType, Record<Outcome, number>>();
  private readonly notes: string[] = [];

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private uploadsDir: string,
    private dryRun: boolean,
    private log: (line: string) => void,
  ) {}

  report(): MigrationReport {
    return {
      dryRun: this.dryRun,
      counts: [...this.counts].map(([type, count]) => ({ type, ...count })),
      notes: this.notes.slice(0, 100),
    };
  }

  async run() {
    await this.listingPhotos();
    await this.avatars();
    await this.categoryImages();
    await this.homepagePoster();
    await this.attachments();
  }

  private async listingPhotos() {
    const rows = await this.prisma.listingPhoto.findMany({ select: { id: true, listingId: true, url: true } });
    for (const row of rows) {
      const match = row.url.match(OLD_LISTING_PHOTO);
      if (!match) continue;
      const key = newImageKey({ kind: 'listingPhoto', listingId: row.listingId }, match[2]);
      await this.moveImage('listingPhoto', `listings/${match[1]}/${match[2]}.webp`, 'listingPhoto', key, () =>
        this.prisma.listingPhoto.update({ where: { id: row.id }, data: { url: key } }),
      );
    }
  }

  private async avatars() {
    const rows = await this.prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { id: true, avatarUrl: true } });
    for (const row of rows) {
      const match = row.avatarUrl!.match(OLD_AVATAR);
      if (!match) continue;
      const key = newImageKey({ kind: 'avatar', userId: row.id }, match[1]);
      await this.moveImage('avatar', `avatars/${match[1]}.webp`, 'avatar', key, () =>
        this.prisma.user.update({ where: { id: row.id }, data: { avatarUrl: key } }),
      );
    }
  }

  private async categoryImages() {
    const rows = await this.prisma.category.findMany({ where: { imageUrl: { not: null } }, select: { id: true, imageUrl: true } });
    for (const row of rows) {
      const match = row.imageUrl!.match(OLD_CATEGORY_IMAGE);
      if (!match) continue;
      const key = newImageKey({ kind: 'categoryImage', categoryId: row.id }, match[1]);
      await this.moveImage('categoryImage', `categories/${match[1]}.webp`, 'categoryImage', key, () =>
        this.prisma.category.update({ where: { id: row.id }, data: { imageUrl: key } }),
      );
    }
  }

  private async homepagePoster() {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'homepage_video_thumbnail' } });
    const match = typeof setting?.value === 'string' ? setting.value.match(OLD_POSTER) : null;
    if (!match) return;
    const key = newImageKey({ kind: 'homepagePoster' }, match[1]);
    await this.moveImage('homepagePoster', `homepage/${match[1]}.webp`, 'homepagePoster', key, () =>
      this.prisma.setting.update({ where: { key: 'homepage_video_thumbnail' }, data: { value: key as Prisma.InputJsonValue } }),
    );
  }

  private async attachments() {
    const rows = await this.prisma.messageAttachment.findMany({
      select: { id: true, url: true, type: true, filename: true, messageId: true, message: { select: { conversationId: true } } },
    });
    for (const row of rows) {
      const match = row.url.match(OLD_ATTACHMENT);
      if (!match) continue;
      const bytes = await this.readOld('attachment', `messages/${match[1]}`);
      if (!bytes) continue;
      // Pictures were already WebP; anything else must really be the PDF its record says it is.
      const extension = match[1].endsWith('.webp')
        ? 'webp'
        : row.type === 'application/pdf' && looksLikePdf(bytes)
          ? 'pdf'
          : null;
      if (!extension) {
        this.note(`Left on disk, not a picture or a PDF: messages/${match[1]} (attachment ${row.id})`);
        this.count('attachment', 'refused');
        continue;
      }
      if (!this.dryRun) {
        const key = attachmentKey(row.message.conversationId, row.messageId, row.id, extension);
        const contentType = extension === 'pdf' ? 'application/pdf' : 'image/webp';
        // Names with č, ć, ž, š or đ were saved garbled (uploadedFileName); this mends them too.
        const filename = uploadedFileName(row.filename);
        await this.storage.put('private', key, bytes, {
          contentType,
          cacheControl: PRIVATE_CACHE_CONTROL,
          contentDisposition: inlineDisposition(filename, extension),
        });
        await this.prisma.messageAttachment.update({
          where: { id: row.id },
          data: { url: key, type: contentType, filename },
        });
      }
      this.count('attachment', 'moved');
    }
  }

  private async moveImage(type: MigrationType, relative: string, kind: ImageKind, key: string, save: () => Promise<unknown>) {
    const bytes = await this.readOld(type, relative);
    if (!bytes) return;
    if (!this.dryRun) {
      const files = await renderFromOld(bytes, kind);
      await Promise.all(
        files.map(({ name, body }) =>
          this.storage.put('public', `${key}/${name}`, body, { contentType: 'image/webp', cacheControl: PUBLIC_CACHE_CONTROL }),
        ),
      );
      await save();
    }
    this.count(type, 'moved');
  }

  private async readOld(type: MigrationType, relative: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.uploadsDir, ...relative.split('/')));
    } catch {
      this.note(`Missing on disk, record left as it is: ${relative}`);
      this.count(type, 'missing');
      return null;
    }
  }

  private note(line: string) {
    this.notes.push(line);
    this.log(line);
  }

  private count(type: MigrationType, outcome: Outcome) {
    const count = this.counts.get(type) ?? { moved: 0, missing: 0, refused: 0 };
    count[outcome]++;
    this.counts.set(type, count);
  }
}

/**
 * The widths of a picture saved before T143. The old file was already WebP at
 * the largest size the site showed, so it is the best copy there is: it
 * becomes the master as it is, and so does every width it does not exceed
 * (no second round of compression); the smaller widths are made from it.
 */
async function renderFromOld(bytes: Buffer, kind: ImageKind): Promise<Array<{ name: string; body: Buffer }>> {
  const profile = IMAGE_PROFILES[kind];
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  const size = profile.boxed ? Math.max(width, height) : width;
  const files: Array<{ name: string; body: Buffer }> = [];
  for (const target of profile.widths) {
    const body =
      target >= size
        ? bytes
        : await sharp(bytes)
            .resize({ width: target, height: profile.boxed ? target : undefined, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: DISPLAY_QUALITY })
            .toBuffer();
    files.push({ name: `${target}.webp`, body });
  }
  if (profile.master) files.push({ name: 'master.webp', body: bytes });
  return files;
}
