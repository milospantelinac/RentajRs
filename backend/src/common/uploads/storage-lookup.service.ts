import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ImageKind, imageKindOf } from './media';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const IMAGE_KEY_IN_TEXT = new RegExp(
  `(listings/${UUID}/photos/${UUID}|users/${UUID}/avatar/${UUID}|categories/${UUID}/${UUID}|site/homepage/video-poster/${UUID})(?:/|$)`,
);
const ATTACHMENT_KEY_IN_TEXT = new RegExp(`conversations/${UUID}/${UUID}/${UUID}\\.(?:webp|pdf)`);
const OLD_ADDRESS_IN_TEXT = new RegExp(
  `/uploads/((?:listings/${UUID}/${UUID}\\.webp)|(?:avatars|categories|homepage)/${UUID}\\.webp|messages/${UUID}\\.[a-z0-9]{1,8})$`,
);

export interface LookupUse {
  type: 'listing' | 'user' | 'category' | 'homepage' | 'message';
  id: string;
  label: string;
  detail?: string;
  link?: string;
}

export interface LookupResult {
  recognized: boolean;
  kind?: ImageKind | 'attachment' | 'old';
  where?: 'public' | 'private' | 'disk';
  location?: string;
  files: Array<{ name: string; bytes: number; lastModified: Date }>;
  usedBy: LookupUse[];
  held: boolean;
  /** Listed by the latest check, and why. */
  pending: string | null;
}

/**
 * T143: paste a picture's or an attachment's link (or key) in
 * Administracija > Skladište and see what is stored under it and which
 * record uses it, for support and for reports of an inappropriate picture.
 * Read only.
 */
@Injectable()
export class StorageLookupService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  async lookup(query: string): Promise<LookupResult> {
    const text = (query ?? '').trim().split(/[?#]/)[0];
    const image = text.match(IMAGE_KEY_IN_TEXT)?.[1];
    if (image) return this.image(image);
    const attachment = text.match(ATTACHMENT_KEY_IN_TEXT)?.[0];
    if (attachment) return this.attachment(attachment);
    const old = text.match(OLD_ADDRESS_IN_TEXT)?.[1];
    if (old) return this.oldFile(old);
    return { recognized: false, files: [], usedBy: [], held: false, pending: null };
  }

  private async image(key: string): Promise<LookupResult> {
    const kind = imageKindOf(key)!;
    const files: LookupResult['files'] = [];
    for await (const object of this.storage.list('public', `${key}/`)) {
      files.push({ name: object.key.slice(key.length + 1), bytes: object.size, lastModified: object.lastModified });
    }
    // By width, the master last.
    files.sort((a, b) => (parseInt(a.name, 10) || Infinity) - (parseInt(b.name, 10) || Infinity));
    return {
      recognized: true,
      kind,
      where: 'public',
      location: `${key}/`,
      files,
      usedBy: await this.usesOfImage(kind, { contains: key }),
      ...(await this.decisions(key)),
    };
  }

  private async attachment(key: string): Promise<LookupResult> {
    const files: LookupResult['files'] = [];
    for await (const object of this.storage.list('private', key)) {
      if (object.key === key) files.push({ name: key.split('/').pop()!, bytes: object.size, lastModified: object.lastModified });
    }
    return {
      recognized: true,
      kind: 'attachment',
      where: 'private',
      location: key,
      files,
      usedBy: await this.usesOfAttachment({ equals: key }),
      ...(await this.decisions(key)),
    };
  }

  /** A file still under the old /uploads/ folder on the server's disk. */
  private async oldFile(relative: string): Promise<LookupResult> {
    const full = path.resolve(process.cwd(), this.config.get<string>('uploads.dir')!, ...relative.split('/'));
    const stat = await fs.stat(full).catch(() => null);
    const folder = relative.split('/')[0];
    const filter = { endsWith: `/${relative}` };
    const usedBy =
      folder === 'listings'
        ? await this.usesOfImage('listingPhoto', filter)
        : folder === 'avatars'
          ? await this.usesOfImage('avatar', filter)
          : folder === 'categories'
            ? await this.usesOfImage('categoryImage', filter)
            : folder === 'homepage'
              ? await this.usesOfImage('homepagePoster', filter)
              : await this.usesOfAttachment(filter);
    return {
      recognized: true,
      kind: 'old',
      where: 'disk',
      location: `/uploads/${relative}`,
      files: stat ? [{ name: relative.split('/').pop()!, bytes: stat.size, lastModified: stat.mtime }] : [],
      usedBy,
      held: false,
      pending: null,
    };
  }

  private async usesOfImage(kind: ImageKind, filter: { contains: string } | { endsWith: string }): Promise<LookupUse[]> {
    if (kind === 'listingPhoto') {
      const rows = await this.prisma.listingPhoto.findMany({
        where: { url: filter },
        select: {
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
      return rows.map(({ listing }) => ({
        type: 'listing',
        id: listing.id,
        label: listing.title || listing.slug,
        detail: `${listing.status} · ${listing.user.firstName} ${listing.user.lastName} (${listing.user.email})`,
        link: listing.status === 'ACTIVE' ? `/oglasi/${listing.slug}` : undefined,
      }));
    }
    if (kind === 'avatar') {
      const users = await this.prisma.user.findMany({
        where: { avatarUrl: filter },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      return users.map((user) => ({ type: 'user', id: user.id, label: `${user.firstName} ${user.lastName}`, detail: user.email }));
    }
    if (kind === 'categoryImage') {
      const categories = await this.prisma.category.findMany({ where: { imageUrl: filter }, select: { id: true, slug: true } });
      return categories.map((category) => ({
        type: 'category',
        id: category.id,
        label: category.slug,
        link: `/admin/kategorije/${category.id}`,
      }));
    }
    const setting = await this.prisma.setting.findUnique({ where: { key: 'homepage_video_thumbnail' } });
    const value = typeof setting?.value === 'string' ? setting.value : '';
    const used = 'contains' in filter ? value.includes(filter.contains) : value.endsWith(filter.endsWith);
    return used ? [{ type: 'homepage', id: 'homepage_video_thumbnail', label: 'homepage_video_thumbnail', link: '/admin/sadrzaj' }] : [];
  }

  private async usesOfAttachment(filter: { equals: string } | { endsWith: string }): Promise<LookupUse[]> {
    const rows = await this.prisma.messageAttachment.findMany({
      where: { url: filter },
      select: {
        id: true,
        filename: true,
        message: {
          select: {
            conversationId: true,
            sentAt: true,
            sender: { select: { firstName: true, lastName: true, anonymizedAt: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      type: 'message',
      id: row.message.conversationId,
      label: row.filename,
      detail: `${row.message.sender.firstName} ${row.message.sender.lastName} · ${row.message.sentAt.toISOString()}`,
    }));
  }

  private async decisions(key: string): Promise<Pick<LookupResult, 'held' | 'pending'>> {
    const [hold, item] = await Promise.all([
      this.prisma.storageHold.findUnique({ where: { key }, select: { id: true } }),
      this.prisma.storageScanItem.findFirst({ where: { key, status: 'PENDING' }, select: { reason: true } }),
    ]);
    return { held: Boolean(hold), pending: item?.reason ?? null };
  }
}
