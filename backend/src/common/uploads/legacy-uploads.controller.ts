import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';
import { StorageService } from './storage.service';
import { imageKindOf, imageUrl } from './media';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LEGACY_IMAGE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;
// Attachments kept the extension the sender's file had.
const LEGACY_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/;

/**
 * T143: what is left of the old /uploads/ folder on the server's disk.
 *
 * A listing photo moved to Object Storage answers its old address with a
 * permanent redirect to the new file, so links search engines and guests
 * already have keep working (point 4 of the card). Until the migration script
 * (src/scripts/migrate-uploads.ts) has moved a file, the file is served from
 * disk, but only while a record still points at it: a deleted photo, a removed
 * avatar or a message attachment once it is private never comes back from here.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('uploads')
export class LegacyUploadsController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  @Get('listings/:listingId/:file')
  async listingPhoto(@Param('listingId') listingId: string, @Param('file') file: string, @Res() res: Response) {
    const fileId = file.match(LEGACY_IMAGE)?.[1];
    if (!UUID.test(listingId) || !fileId) throw new NotFoundException();

    // The moved photo's folder is named after the old file (migrate-uploads.ts).
    // Found by that name alone: a row copied from another listing keeps that
    // listing's id in its old address.
    const moved = await this.prisma.listingPhoto.findFirst({
      where: { url: { endsWith: `/photos/${fileId}` } },
      select: { url: true },
    });
    if (moved && imageKindOf(moved.url) === 'listingPhoto') {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.redirect(301, imageUrl(this.storage.publicBaseUrl, moved.url));
    }

    const relative = `listings/${listingId}/${file}`;
    const stillUsed = await this.prisma.listingPhoto.findFirst({
      where: { url: { endsWith: `/${relative}` } },
      select: { id: true },
    });
    return this.sendFromDisk(res, relative, stillUsed ? 'image/webp' : null);
  }

  @Get(':folder/:file')
  async file(@Param('folder') folder: string, @Param('file') file: string, @Res() res: Response) {
    if (!LEGACY_FILE.test(file)) throw new NotFoundException();
    const relative = `${folder}/${file}`;
    return this.sendFromDisk(res, relative, await this.typeWhileUsed(folder, `/${relative}`), folder === 'messages');
  }

  /** The type to send a file with while a record still points at it, or null. */
  private async typeWhileUsed(folder: string, suffix: string): Promise<string | null> {
    switch (folder) {
      case 'avatars': {
        const user = await this.prisma.user.findFirst({ where: { avatarUrl: { endsWith: suffix } }, select: { id: true } });
        return user ? 'image/webp' : null;
      }
      case 'categories': {
        const category = await this.prisma.category.findFirst({
          where: { imageUrl: { endsWith: suffix } },
          select: { id: true },
        });
        return category ? 'image/webp' : null;
      }
      case 'homepage': {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'homepage_video_thumbnail' } });
        return typeof setting?.value === 'string' && setting.value.endsWith(suffix) ? 'image/webp' : null;
      }
      case 'messages': {
        // Sent with the type the record has, never the one its extension suggests.
        const attachment = await this.prisma.messageAttachment.findFirst({
          where: { url: { endsWith: suffix } },
          select: { type: true },
        });
        if (!attachment) return null;
        return suffix.endsWith('.webp') ? 'image/webp' : attachment.type === 'application/pdf' ? attachment.type : null;
      }
      default:
        return null;
    }
  }

  private async sendFromDisk(res: Response, relative: string, contentType: string | null, download = false) {
    if (!contentType) throw new NotFoundException();
    const full = path.resolve(process.cwd(), this.config.get<string>('uploads.dir')!, relative);
    try {
      await fs.access(full);
    } catch {
      throw new NotFoundException();
    }
    res.type(contentType);
    res.set('Cache-Control', 'no-cache');
    if (download) res.set('Content-Disposition', 'attachment');
    return res.sendFile(full);
  }
}
