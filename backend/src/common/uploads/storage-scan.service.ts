import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { Prisma, StorageItemReason, StorageScanItem } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { StoragePolicy, StorageSettingsService } from './storage-settings.service';
import { ImageKind, IMAGE_PROFILES, imageFolderOf, imageKeyOf, imageKindOf, imageUrl, isAttachmentKey } from './media';

// An upload in progress has its files in the bucket a moment before its
// record exists, so nothing younger than a day counts as forgotten.
const ORPHAN_MIN_AGE_MS = 24 * 60 * 60_000;

// A check that would list most of a bucket as forgotten says so on top of its
// list: the database it read is likely not the one these files belong to.
const WARNING_SHARE = 0.5;
const WARNING_MIN_COUNT = 20;

// A check still RUNNING after this long died with its process.
const STALE_RUN_MS = 2 * 60 * 60_000;

const PUBLIC_PREFIXES = ['listings/', 'users/', 'categories/', 'site/'];
const PRIVATE_PREFIXES = ['conversations/'];
const DAY_MS = 24 * 60 * 60_000;
const ITEM_WRITE_BATCH = 500;

export type UsageKind = ImageKind | 'attachment' | 'other';
export type StorageUsage = {
  public: { files: number; bytes: number };
  private: { files: number; bytes: number };
  kinds: Record<UsageKind, { items: number; files: number; bytes: number }>;
};

/** Why an approved item was left: it is in use again, kept, back from deletion, or not due yet. */
export type SkipReason = 'held' | 'in_use' | 'restored' | 'not_expired';

/**
 * T143 (user, 2026-10-11): the storage check never deletes anything on its
 * own. It lists what could go (StorageScanItem): files no record points at
 * (ORPHAN), photos of listings deleted longer ago than their retention
 * (DELETED_LISTING) and attachments sent by accounts deleted longer ago than
 * theirs (DELETED_ACCOUNT); an admin deletes or keeps them from
 * Administracija > Skladište. Every approved item is checked again just
 * before it goes.
 */
@Injectable()
export class StorageScanService {
  private readonly logger = new Logger(StorageScanService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private settings: StorageSettingsService,
    private events: EventEmitter2,
    private i18n: I18nService,
  ) {}

  // -- Running the check ---------------------------------------------------

  /** Starts a check; the row comes back at once, `done` settles when the check has. */
  async start(trigger: 'manual' | 'schedule', adminId?: string) {
    if (await this.runningScan()) throw new ConflictException(this.i18n.t('errors.STORAGE_SCAN_RUNNING'));
    const scan = await this.prisma.storageScan.create({ data: { trigger, triggeredById: adminId ?? null } });
    if (adminId) await this.log(adminId, 'storage.scan_started', null, { scanId: scan.id });
    return { scan, done: this.run(scan.id) };
  }

  /** As often as Administracija > Skladište says; never more than once a day. */
  @Cron('0 45 4 * * *')
  async scheduled() {
    const { scanFrequency } = await this.settings.get();
    if (scanFrequency === 'off') return;
    const last = await this.prisma.storageScan.findFirst({ where: { status: 'DONE' }, orderBy: { startedAt: 'desc' } });
    const minAgeMs = scanFrequency === 'daily' ? 20 * 60 * 60_000 : 6.5 * DAY_MS;
    if (last?.finishedAt && Date.now() - last.finishedAt.getTime() < minAgeMs) return;
    try {
      const { done } = await this.start('schedule');
      await done;
    } catch (error) {
      this.logger.warn(`Scheduled storage check not run: ${(error as Error).message}`);
    }
  }

  /**
   * The privacy policy promises that a deleted account's data goes. Every
   * morning, while attachments of accounts deleted longer ago than their
   * retention are still stored, the admins are reminded (once a day).
   */
  @Cron('0 0 9 * * *')
  async remindOverdueAccountFiles(now = new Date()) {
    const count = await this.overdueAccountAttachments(now);
    if (!count) return;
    const recent = await this.prisma.emailLog.findFirst({
      where: { event: 'admin_storage_deletion_pending', sentAt: { gte: new Date(now.getTime() - 20 * 60 * 60_000) } },
      select: { id: true },
    });
    if (!recent) this.events.emit('storage.deletion_pending', { count });
  }

  /** Attachments of accounts deleted longer ago than their retention, still stored and not kept. */
  async overdueAccountAttachments(now = new Date()): Promise<number> {
    const policy = await this.settings.get();
    const rows = await this.prisma.messageAttachment.findMany({
      where: { message: { sender: { anonymizedAt: { lt: cutoff(now, policy.accountAttachmentRetentionDays) } } } },
      select: { url: true },
    });
    const keys = rows.map((row) => row.url).filter(isAttachmentKey);
    if (!keys.length) return 0;
    const held = await this.prisma.storageHold.count({ where: { key: { in: keys } } });
    return keys.length - held;
  }

  async run(scanId: string, now = new Date()): Promise<void> {
    try {
      const policy = await this.settings.get();
      const [references, holds] = await Promise.all([
        this.references(),
        this.prisma.storageHold.findMany({ select: { key: true } }),
      ]);
      const held = new Set(holds.map((hold) => hold.key));
      const usage = emptyUsage();

      const folders = new Map<string, { files: number; bytes: number; newest: number }>();
      for (const prefix of PUBLIC_PREFIXES) {
        for await (const object of this.storage.list('public', prefix)) {
          usage.public.files++;
          usage.public.bytes += object.size;
          const folder = imageFolderOf(object.key);
          const kind = folder ? imageKindOf(folder) : null;
          if (!folder || !kind) {
            usage.kinds.other.files++;
            usage.kinds.other.bytes += object.size;
            continue;
          }
          const entry = folders.get(folder) ?? { files: 0, bytes: 0, newest: 0 };
          if (!folders.has(folder)) usage.kinds[kind].items++;
          entry.files++;
          entry.bytes += object.size;
          entry.newest = Math.max(entry.newest, object.lastModified.getTime());
          folders.set(folder, entry);
          usage.kinds[kind].files++;
          usage.kinds[kind].bytes += object.size;
        }
      }

      const attachments = new Map<string, { bytes: number; lastModified: Date }>();
      for (const prefix of PRIVATE_PREFIXES) {
        for await (const object of this.storage.list('private', prefix)) {
          usage.private.files++;
          usage.private.bytes += object.size;
          usage.kinds.attachment.items++;
          usage.kinds.attachment.files++;
          usage.kinds.attachment.bytes += object.size;
          attachments.set(object.key, { bytes: object.size, lastModified: object.lastModified });
        }
      }

      const items: Array<Omit<Prisma.StorageScanItemCreateManyInput, 'scanId'>> = [];
      const listed = new Set<string>();
      const add = (item: Omit<Prisma.StorageScanItemCreateManyInput, 'scanId'>) => {
        if (listed.has(item.key) || held.has(item.key)) return;
        listed.add(item.key);
        items.push(item);
      };

      for (const [folder, entry] of folders) {
        if (references.images.has(folder) || now.getTime() - entry.newest <= ORPHAN_MIN_AGE_MS) continue;
        add({ bucket: 'public', key: folder, reason: 'ORPHAN', files: entry.files, bytes: entry.bytes, lastModified: new Date(entry.newest) });
      }
      for (const [key, entry] of attachments) {
        if (references.attachments.has(key) || now.getTime() - entry.lastModified.getTime() <= ORPHAN_MIN_AGE_MS) continue;
        add({ bucket: 'private', key, reason: 'ORPHAN', files: 1, bytes: entry.bytes, lastModified: entry.lastModified });
      }
      const orphans = { public: items.filter((i) => i.bucket === 'public').length, private: items.filter((i) => i.bucket === 'private').length };

      // A photo row copied to a listing still live keeps the files (whyKeep says "restored" too).
      const livePhotos = await this.prisma.listingPhoto.findMany({
        where: { listing: { status: { not: 'DELETED' } } },
        select: { url: true },
      });
      const liveKeys = new Set(livePhotos.map((photo) => imageKeyOf(photo.url, this.storage.publicBaseUrl)));
      const deletedListings = await this.prisma.listing.findMany({
        where: {
          status: 'DELETED',
          deletedAt: { lt: cutoff(now, policy.listingPhotoRetentionDays) },
          photos: { some: {} },
        },
        select: { id: true, title: true, slug: true, deletedAt: true, photos: { select: { url: true } } },
      });
      for (const listing of deletedListings) {
        for (const photo of listing.photos) {
          const key = imageKeyOf(photo.url, this.storage.publicBaseUrl);
          const entry = key ? folders.get(key) : undefined;
          if (!key || !entry || liveKeys.has(key)) continue;
          add({
            bucket: 'public',
            key,
            reason: 'DELETED_LISTING',
            files: entry.files,
            bytes: entry.bytes,
            lastModified: new Date(entry.newest),
            sourceId: listing.id,
            dueAt: new Date(listing.deletedAt!.getTime() + policy.listingPhotoRetentionDays * DAY_MS),
            context: { listingId: listing.id, title: listing.title, slug: listing.slug, deletedAt: listing.deletedAt },
          });
        }
      }

      const expiredAttachments = await this.prisma.messageAttachment.findMany({
        where: { message: { sender: { anonymizedAt: { lt: cutoff(now, policy.accountAttachmentRetentionDays) } } } },
        select: {
          id: true,
          url: true,
          filename: true,
          message: { select: { conversationId: true, sentAt: true, sender: { select: { anonymizedAt: true } } } },
        },
      });
      for (const attachment of expiredAttachments) {
        const entry = attachments.get(attachment.url);
        if (!entry) continue;
        const anonymizedAt = attachment.message.sender.anonymizedAt!;
        add({
          bucket: 'private',
          key: attachment.url,
          reason: 'DELETED_ACCOUNT',
          files: 1,
          bytes: entry.bytes,
          lastModified: entry.lastModified,
          sourceId: attachment.id,
          dueAt: new Date(anonymizedAt.getTime() + policy.accountAttachmentRetentionDays * DAY_MS),
          context: {
            attachmentId: attachment.id,
            filename: attachment.filename,
            conversationId: attachment.message.conversationId,
            sentAt: attachment.message.sentAt,
            accountDeletedAt: anonymizedAt,
          },
        });
      }

      const warning = tooMany(orphans.public, folders.size) || tooMany(orphans.private, attachments.size);
      await this.prisma.$transaction(
        async (tx) => {
          for (let i = 0; i < items.length; i += ITEM_WRITE_BATCH) {
            await tx.storageScanItem.createMany({
              data: items.slice(i, i + ITEM_WRITE_BATCH).map((item) => ({ ...item, scanId })),
            });
          }
          // What an earlier check listed is listed again by this one, or no longer.
          await tx.storageScanItem.updateMany({
            where: { status: 'PENDING', scanId: { not: scanId } },
            data: { status: 'SUPERSEDED' },
          });
          await tx.storageScan.update({
            where: { id: scanId },
            data: { status: 'DONE', finishedAt: new Date(), usage: usage as unknown as Prisma.InputJsonValue, warning },
          });
        },
        { timeout: 60_000 },
      );
      this.logger.log(`Storage check done: ${items.length} item(s) to decide on${warning ? ' (warning: most of a bucket)' : ''}`);
    } catch (error) {
      this.logger.error(`Storage check failed: ${(error as Error).message}`);
      await this.prisma.storageScan
        .update({ where: { id: scanId }, data: { status: 'FAILED', finishedAt: new Date(), error: (error as Error).message } })
        .catch(() => undefined);
    }
  }

  // -- What an admin sees and decides ---------------------------------------

  async latestScans(take = 12) {
    return this.prisma.storageScan.findMany({ orderBy: { startedAt: 'desc' }, take });
  }

  /** The PENDING items of the latest finished check, with what the admin needs to recognise each. */
  async items(options: { reason?: StorageItemReason; skip?: number; take?: number } = {}, now = new Date()) {
    const latest = await this.prisma.storageScan.findFirst({ where: { status: 'DONE' }, orderBy: { startedAt: 'desc' } });
    if (!latest) return { scanId: null, total: 0, items: [] };
    const where: Prisma.StorageScanItemWhereInput = {
      scanId: latest.id,
      status: 'PENDING',
      ...(options.reason ? { reason: options.reason } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.storageScanItem.count({ where }),
      this.prisma.storageScanItem.findMany({
        where,
        orderBy: [{ reason: 'asc' }, { lastModified: 'asc' }],
        skip: options.skip ?? 0,
        take: Math.min(options.take ?? 100, 500),
      }),
    ]);
    return { scanId: latest.id, total, items: rows.map((row) => this.describeItem(row, now)) };
  }

  /** How many PENDING items the latest check has per reason, and how much they hold. */
  async pendingSummary() {
    const latest = await this.prisma.storageScan.findFirst({ where: { status: 'DONE' }, orderBy: { startedAt: 'desc' } });
    if (!latest) return [];
    const groups = await this.prisma.storageScanItem.groupBy({
      by: ['reason'],
      where: { scanId: latest.id, status: 'PENDING' },
      _count: { _all: true },
      _sum: { bytes: true, files: true },
    });
    return groups.map((group) => ({
      reason: group.reason,
      items: group._count._all,
      files: group._sum.files ?? 0,
      bytes: group._sum.bytes ?? 0,
    }));
  }

  /** Deletes the approved items that still may go; the rest are left with the reason why. */
  async deleteItems(adminId: string, ids: string[], now = new Date()) {
    if (await this.runningScan()) throw new ConflictException(this.i18n.t('errors.STORAGE_SCAN_RUNNING'));
    const items = await this.prisma.storageScanItem.findMany({ where: { id: { in: ids }, status: 'PENDING' } });
    const policy = await this.settings.get();
    const held = new Set(
      (await this.prisma.storageHold.findMany({ where: { key: { in: items.map((item) => item.key) } }, select: { key: true } })).map(
        (hold) => hold.key,
      ),
    );
    const result = { deleted: 0, skipped: 0, failed: 0, notPending: ids.length - items.length };
    const deletedKeys: string[] = [];

    for (const item of items) {
      const skip = held.has(item.key) ? 'held' : await this.whyKeep(item, policy, now);
      if (skip) {
        await this.prisma.storageScanItem.update({
          where: { id: item.id },
          data: { status: 'SKIPPED', note: skip, decidedById: adminId, decidedAt: now },
        });
        result.skipped++;
        continue;
      }
      try {
        if (item.bucket === 'public') await this.storage.deletePrefix('public', `${item.key}/`);
        else await this.storage.deleteObject('private', item.key);
        if (item.reason === 'DELETED_LISTING') {
          await this.prisma.listingPhoto.deleteMany({ where: { url: { contains: item.key }, listing: { status: 'DELETED' } } });
        }
        if (item.reason === 'DELETED_ACCOUNT' && item.sourceId) {
          await this.prisma.messageAttachment.deleteMany({ where: { id: item.sourceId, url: item.key } });
        }
        await this.prisma.storageScanItem.update({
          where: { id: item.id },
          data: { status: 'DELETED', decidedById: adminId, decidedAt: now, note: null },
        });
        deletedKeys.push(location(item));
        result.deleted++;
      } catch (error) {
        // Left PENDING, so it can be tried again.
        await this.prisma.storageScanItem.update({ where: { id: item.id }, data: { note: (error as Error).message.slice(0, 500) } });
        result.failed++;
      }
    }

    // Ids that were no longer waiting changed nothing, so they leave no history entry.
    if (result.deleted || result.skipped || result.failed) {
      await this.log(adminId, 'storage.files_deleted', null, { ...result, files: deletedKeys.slice(0, 50) });
    }
    return result;
  }

  /** Keeps the items for good: later checks never list them again (StorageHold). */
  async keepItems(adminId: string, ids: string[], now = new Date()) {
    const items = await this.prisma.storageScanItem.findMany({ where: { id: { in: ids }, status: 'PENDING' } });
    for (const item of items) {
      await this.prisma.$transaction([
        this.prisma.storageHold.upsert({
          where: { key: item.key },
          create: { bucket: item.bucket, key: item.key, reason: item.reason, createdById: adminId },
          update: {},
        }),
        this.prisma.storageScanItem.update({
          where: { id: item.id },
          data: { status: 'KEPT', decidedById: adminId, decidedAt: now },
        }),
      ]);
    }
    if (items.length) await this.log(adminId, 'storage.files_kept', null, { kept: items.length, files: items.slice(0, 50).map(location) });
    return { kept: items.length, notPending: ids.length - items.length };
  }

  async holds() {
    const rows = await this.prisma.storageHold.findMany({ orderBy: { createdAt: 'desc' } });
    const names = await this.userNames(rows.map((row) => row.createdById));
    return rows.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      location: row.bucket === 'public' ? `${row.key}/` : row.key,
      reason: row.reason,
      createdAt: row.createdAt,
      createdBy: row.createdById ? (names.get(row.createdById) ?? null) : null,
    }));
  }

  /** Lets go of a kept file; the next check may list it again. */
  async removeHold(adminId: string, id: string) {
    const hold = await this.prisma.storageHold.findUnique({ where: { id } });
    if (!hold) throw new NotFoundException();
    await this.prisma.storageHold.delete({ where: { id } });
    await this.log(adminId, 'storage.hold_removed', { file: hold.bucket === 'public' ? `${hold.key}/` : hold.key }, null);
    return { removed: true };
  }

  async userNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
  }

  async log(adminId: string, action: string, oldValue: unknown, newValue: unknown) {
    await this.prisma.adminLog.create({
      data: {
        userId: adminId,
        action,
        entityType: 'Storage',
        oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
        newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  // -- Internals ----------------------------------------------------------

  private async runningScan() {
    return this.prisma.storageScan.findFirst({
      where: { status: 'RUNNING', startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
      select: { id: true },
    });
  }

  /** Every image folder and attachment a record points at. */
  private async references(): Promise<{ images: Set<string>; attachments: Set<string> }> {
    const [photos, users, categories, settings, attachments] = await Promise.all([
      this.prisma.listingPhoto.findMany({ select: { url: true } }),
      this.prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } }),
      this.prisma.category.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
      this.prisma.setting.findMany({ where: { key: 'homepage_video_thumbnail' }, select: { value: true } }),
      this.prisma.messageAttachment.findMany({ select: { url: true } }),
    ]);
    const images = new Set<string>();
    for (const value of [
      ...photos.map((row) => row.url),
      ...users.map((row) => row.avatarUrl),
      ...categories.map((row) => row.imageUrl),
      ...settings.map((row) => row.value),
    ]) {
      const key = imageKeyOf(value, this.storage.publicBaseUrl);
      if (key) images.add(key);
    }
    return { images, attachments: new Set(attachments.map((row) => row.url)) };
  }

  /** Why an approved item must stay after all, checked against the database as it is now; null when it may go. */
  private async whyKeep(item: StorageScanItem, policy: StoragePolicy, now: Date): Promise<SkipReason | null> {
    if (item.bucket === 'private') {
      const attachment = await this.prisma.messageAttachment.findFirst({
        where: { url: item.key },
        select: { message: { select: { sender: { select: { anonymizedAt: true } } } } },
      });
      if (!attachment) return null;
      if (item.reason !== 'DELETED_ACCOUNT') return 'in_use';
      const anonymizedAt = attachment.message.sender.anonymizedAt;
      return anonymizedAt && anonymizedAt < cutoff(now, policy.accountAttachmentRetentionDays) ? null : 'not_expired';
    }

    const kind = imageKindOf(item.key);
    if (kind === 'listingPhoto') {
      const rows = await this.prisma.listingPhoto.findMany({
        where: { url: { contains: item.key } },
        select: { listing: { select: { status: true, deletedAt: true } } },
      });
      if (!rows.length) return null;
      if (item.reason !== 'DELETED_LISTING') return 'in_use';
      if (rows.some((row) => row.listing.status !== 'DELETED')) return 'restored';
      const due = cutoff(now, policy.listingPhotoRetentionDays);
      return rows.every((row) => row.listing.deletedAt && row.listing.deletedAt < due) ? null : 'not_expired';
    }
    if (kind === 'avatar') {
      return (await this.prisma.user.findFirst({ where: { avatarUrl: { contains: item.key } }, select: { id: true } })) ? 'in_use' : null;
    }
    if (kind === 'categoryImage') {
      const used = await this.prisma.category.findFirst({ where: { imageUrl: { contains: item.key } }, select: { id: true } });
      return used ? 'in_use' : null;
    }
    if (kind === 'homepagePoster') {
      const setting = await this.prisma.setting.findUnique({ where: { key: 'homepage_video_thumbnail' } });
      return typeof setting?.value === 'string' && setting.value.includes(item.key) ? 'in_use' : null;
    }
    // Not an image folder this build makes: never deleted from here.
    return 'in_use';
  }

  private describeItem(row: StorageScanItem, now: Date) {
    const kind = row.bucket === 'public' ? imageKindOf(row.key) : null;
    return {
      id: row.id,
      bucket: row.bucket,
      reason: row.reason,
      location: location(row),
      kind: kind ?? 'attachment',
      // The smallest width, to show what would go; private files are not shown.
      previewUrl: kind ? imageUrl(this.storage.publicBaseUrl, row.key, IMAGE_PROFILES[kind].widths[0]) : null,
      files: row.files,
      bytes: row.bytes,
      lastModified: row.lastModified,
      dueAt: row.dueAt,
      overdue: row.reason === 'DELETED_ACCOUNT' && row.dueAt !== null && row.dueAt < now,
      context: row.context,
      note: row.note,
    };
  }
}

/** A picture's folder is shown with its slash; the API leaves that alone (MediaUrlInterceptor only turns keys into URLs). */
function location(item: { bucket: string; key: string }): string {
  return item.bucket === 'public' ? `${item.key}/` : item.key;
}

function cutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function tooMany(orphans: number, total: number): boolean {
  return orphans >= WARNING_MIN_COUNT && orphans > total * WARNING_SHARE;
}

function emptyUsage(): StorageUsage {
  const zero = () => ({ items: 0, files: 0, bytes: 0 });
  return {
    public: { files: 0, bytes: 0 },
    private: { files: 0, bytes: 0 },
    kinds: {
      listingPhoto: zero(),
      avatar: zero(),
      categoryImage: zero(),
      homepagePoster: zero(),
      attachment: zero(),
      other: zero(),
    },
  };
}
