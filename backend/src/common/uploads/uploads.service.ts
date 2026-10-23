import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import sharp from 'sharp';
import { StorageService } from './storage.service';
import { StorageSettingsService } from './storage-settings.service';
import {
  IMAGE_PROFILES,
  ImageProfile,
  ImageTarget,
  attachmentKey,
  imageKeyOf,
  isAttachmentKey,
  newImageKey,
} from './media';
import { toNestPaySafeAscii } from '../utils/ascii-transliterate';
import { EmptyIconError, iconShape } from './icon-shape';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF_TYPE = 'application/pdf';
const SVG_TYPE = 'image/svg+xml';
// T129: an uploaded icon (a category's, a field's, an amenity item's) may also come as an SVG (a Figma export).
const ICON_TYPES = [...IMAGE_TYPES, SVG_TYPE];

// T143 point 5: multer holds a whole upload in memory before any check runs,
// so every upload route caps it here. The real limits, set in
// Administracija > Skladište (StorageSettingsService, at most this cap), are
// checked below with their own message.
export const UPLOAD_LIMITS = { fileSize: 20 * 1024 * 1024, files: 1 };

// R85: message attachments are a picture or a PDF.
export const ATTACHMENT_TYPES = [...IMAGE_TYPES, PDF_TYPE];
const ATTACHMENT_IMAGE_WIDTH = 1600;

export const DISPLAY_QUALITY = 82;
const MASTER_QUALITY = 90;

// Public file names are never reused, so a browser may keep one for a year.
export const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const PRIVATE_CACHE_CONTROL = 'private, max-age=3600';

/**
 * Every upload path (listing photos, avatars, category icons, the
 * homepage poster, message attachments) goes through here rather than
 * reimplementing resize and storage per feature. Pictures are re-encoded
 * through sharp rather than stored as they came: this both optimizes them and
 * strips anything that isn't a real, decodable image (Ch.16.1, "uploaded files
 * aren't disguised executables"). T143: the results go to Object Storage
 * (StorageService), each picture as a master copy plus the widths the site
 * shows; the record keeps the key that media.ts builds.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private i18n: I18nService,
    private storage: StorageService,
    private settings: StorageSettingsService,
  ) {}

  /** Stores a picture for its record and returns the key to save on it. */
  async saveImage(file: Express.Multer.File | undefined, target: ImageTarget): Promise<string> {
    if (!file) throw new BadRequestException(this.i18n.t('errors.FILE_REQUIRED'));
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      // Dizajn 27: the photos step shows this to the owner, so it has to be in their language.
      throw new BadRequestException(this.i18n.t('errors.IMAGE_TYPE_NOT_ALLOWED'));
    }
    await this.checkPictureSize(file);
    return this.storeImage(file.buffer, target);
  }

  /**
   * T129: the icon an admin uploads for a category, kept under it
   * (categories/{categoryId}/{fileId}) as its shape only (icon-shape.ts),
   * which the site fills with the text colour. An SVG is accepted too: it is
   * drawn here, and only the drawing is stored.
   */
  async saveCategoryIcon(file: Express.Multer.File | undefined, categoryId: string): Promise<string> {
    return this.storeImage(await this.uploadedIconShape(file), { kind: 'categoryImage', categoryId });
  }

  /**
   * T129: an icon an admin uploads for a field or an amenity item
   * (site/attribute-icons/{fileId}), kept and shown as a category icon is.
   * It belongs to no record of its own: the items that wear it hold its key.
   */
  async saveAttributeIcon(file: Express.Multer.File | undefined): Promise<string> {
    return this.storeImage(await this.uploadedIconShape(file), { kind: 'attributeIcon' });
  }

  private async uploadedIconShape(file: Express.Multer.File | undefined): Promise<Buffer> {
    if (!file) throw new BadRequestException(this.i18n.t('errors.FILE_REQUIRED'));
    if (!ICON_TYPES.includes(file.mimetype)) throw new BadRequestException(this.i18n.t('errors.ICON_TYPE_NOT_ALLOWED'));
    await this.checkPictureSize(file);
    try {
      return await iconShape(file.buffer, file.mimetype === SVG_TYPE);
    } catch (error) {
      if (error instanceof EmptyIconError) throw new BadRequestException(this.i18n.t('errors.ICON_EMPTY'));
      throw new BadRequestException(this.i18n.t('errors.IMAGE_INVALID'));
    }
  }

  private async checkPictureSize(file: Express.Multer.File) {
    const { photoMaxMb: maxSizeMb } = await this.settings.uploadLimits();
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new BadRequestException(this.i18n.t('errors.IMAGE_TOO_LARGE', { args: { max: maxSizeMb } }));
    }
  }

  /** Writes a picture's widths and master under a new folder of its record; the folder is its key. */
  private async storeImage(input: Buffer, target: ImageTarget): Promise<string> {
    const files = await this.renderImage(input, IMAGE_PROFILES[target.kind]);
    const key = newImageKey(target);
    try {
      await Promise.all(
        files.map(({ name, body }) =>
          this.storage.put('public', `${key}/${name}`, body, {
            contentType: 'image/webp',
            cacheControl: PUBLIC_CACHE_CONTROL,
          }),
        ),
      );
    } catch (error) {
      await this.storage.deletePrefix('public', `${key}/`).catch(() => undefined);
      throw error;
    }
    return key;
  }

  /**
   * The files of one picture: each display width, then the master copy the
   * widths can be made again from. A picture smaller than a width keeps its
   * own size under that name, so every name in the folder always exists.
   */
  async renderImage(input: Buffer, profile: ImageProfile): Promise<Array<{ name: string; body: Buffer }>> {
    // rotate() turns the picture the way its EXIF says, and the output keeps no EXIF (nor its GPS position).
    const source = sharp(input).rotate();
    const outputs = [
      ...profile.widths.map((width) => ({
        name: `${width}.webp`,
        box: { width, height: profile.boxed ? width : undefined },
        quality: DISPLAY_QUALITY,
      })),
      ...(profile.master
        ? [{ name: 'master.webp', box: { width: profile.master, height: profile.master }, quality: MASTER_QUALITY }]
        : []),
    ];
    const files: Array<{ name: string; body: Buffer }> = [];
    try {
      // One at a time: each holds a decoded copy of the picture in memory.
      for (const output of outputs) {
        const body = await source
          .clone()
          .resize({ ...output.box, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: output.quality })
          .toBuffer();
        files.push({ name: output.name, body });
      }
    } catch {
      throw new BadRequestException(this.i18n.t('errors.IMAGE_INVALID'));
    }
    return files;
  }

  /** R85: a message attachment, a picture (stored as WebP) or a PDF, into the private bucket. */
  async saveAttachment(
    file: Express.Multer.File | undefined,
    place: { conversationId: string; messageId: string; attachmentId: string },
  ): Promise<{ key: string; contentType: string }> {
    if (!file) throw new BadRequestException(this.i18n.t('errors.FILE_REQUIRED'));
    if (!ATTACHMENT_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(this.i18n.t('errors.ATTACHMENT_TYPE_NOT_ALLOWED'));
    }
    const { attachmentMaxMb } = await this.settings.uploadLimits();
    if (file.size > attachmentMaxMb * 1024 * 1024) {
      throw new BadRequestException(this.i18n.t('errors.ATTACHMENT_TOO_LARGE', { args: { max: attachmentMaxMb } }));
    }

    let body: Buffer;
    let extension: 'webp' | 'pdf';
    if (file.mimetype === PDF_TYPE) {
      // The declared type is the browser's guess from the name; a page saved
      // as .pdf must not be stored as one.
      if (!looksLikePdf(file.buffer)) throw new BadRequestException(this.i18n.t('errors.ATTACHMENT_INVALID'));
      body = file.buffer;
      extension = 'pdf';
    } else {
      try {
        body = await sharp(file.buffer)
          .rotate()
          .resize({ width: ATTACHMENT_IMAGE_WIDTH, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: DISPLAY_QUALITY })
          .toBuffer();
      } catch {
        throw new BadRequestException(this.i18n.t('errors.IMAGE_INVALID'));
      }
      extension = 'webp';
    }

    const key = attachmentKey(place.conversationId, place.messageId, place.attachmentId, extension);
    const contentType = extension === 'pdf' ? PDF_TYPE : 'image/webp';
    await this.storage.put('private', key, body, {
      contentType,
      cacheControl: PRIVATE_CACHE_CONTROL,
      contentDisposition: inlineDisposition(uploadedFileName(file.originalname), extension),
    });
    return { key, contentType };
  }

  /** What the browser opens for an attachment: a signed link, or the old address of one not moved yet. */
  async attachmentUrl(value: string): Promise<string> {
    return isAttachmentKey(value) ? this.storage.signedUrl(value) : value;
  }

  /**
   * Deletes a picture's folder. The record has already let go of it, so a
   * failure is only logged; the storage check (StorageScanService) lists what is left.
   * Values that are not ours (a Google avatar, a photo not moved yet) are left alone.
   */
  async removeImage(value: string | null | undefined): Promise<void> {
    const key = imageKeyOf(value, this.storage.publicBaseUrl);
    if (!key) return;
    try {
      await this.storage.deletePrefix('public', `${key}/`);
    } catch (error) {
      this.logger.warn(`Could not delete ${key}: ${(error as Error).message}`);
    }
  }

  async removeAttachment(value: string): Promise<void> {
    if (!isAttachmentKey(value)) return;
    try {
      await this.storage.deleteObject('private', value);
    } catch (error) {
      this.logger.warn(`Could not delete ${value}: ${(error as Error).message}`);
    }
  }
}

/**
 * The sender's file name. Multer reads it as Latin-1 while browsers send
 * UTF-8, so "Račun.pdf" arrived as "RaÄ\u008dun.pdf"; it is read again as
 * UTF-8, unless those bytes are no UTF-8 (a name that was right already, or a
 * client that really sent Latin-1).
 */
export function uploadedFileName(name: string): string {
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return /[^\u0000-ÿ]/.test(name) || utf8.includes('�') ? name : utf8;
}

export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).includes('%PDF-');
}

/**
 * Opens in the browser under the sender's file name, with the extension of
 * what is actually stored. Header values must be ASCII: the plain name loses
 * its diacritics, the filename* one keeps them.
 */
export function inlineDisposition(originalName: string, extension: string): string {
  const base = (originalName || '').replace(/\.[^.]*$/, '').replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim() || 'prilog';
  const asciiBase = toNestPaySafeAscii(base).replace(/["\\]/g, '').trim() || 'prilog';
  const encoded = encodeURIComponent(`${base}.${extension}`).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${asciiBase}.${extension}"; filename*=UTF-8''${encoded}`;
}
