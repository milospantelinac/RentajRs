import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Centralized image handling — every upload path (avatar, listing photos,
 * message attachments) goes through here rather than reimplementing resize
 * and storage per-feature. Files are re-encoded through sharp rather than
 * stored as-is: this both optimizes them (performance requirement) and
 * strips anything that isn't a real, decodable image, which is the
 * practical form of "checking uploaded files aren't disguised executables"
 * (Ch.16.1) — a corrupt/non-image buffer simply fails to decode.
 */
@Injectable()
export class UploadsService {
  constructor(private config: ConfigService) {}

  async saveImage(
    file: Express.Multer.File,
    folder: string,
    options: { maxWidth: number; maxHeight?: number; maxSizeMb?: number } = { maxWidth: 1600 },
  ): Promise<{ url: string; relativePath: string }> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG or WEBP images are allowed');
    }

    // R85 needs a tighter cap for message images (5MB) than the general
    // listing-photo/avatar default (uploads.maxPhotoSizeMb, 8MB) — callers
    // that care pass maxSizeMb explicitly; everyone else keeps today's limit.
    const maxSizeMb = options.maxSizeMb ?? this.config.get<number>('uploads.maxPhotoSizeMb')!;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File is too large');
    }

    let processed: Buffer;
    try {
      processed = await sharp(file.buffer)
        .rotate() // respects EXIF orientation, then strips EXIF on output
        .resize({ width: options.maxWidth, height: options.maxHeight, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('The uploaded file is not a valid image');
    }

    const dir = path.join(process.cwd(), this.config.get<string>('uploads.dir')!, folder);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    await fs.writeFile(path.join(dir, filename), processed);

    const relativePath = `${folder}/${filename}`;
    return { url: `${this.config.get<string>('uploads.baseUrl')}/${relativePath}`, relativePath };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const full = path.join(process.cwd(), this.config.get<string>('uploads.dir')!, relativePath);
    await fs.unlink(full).catch(() => undefined);
  }

  /** For non-image attachments (PDFs) — R85: message attachments allow images or PDF, up to 5 MB. */
  async saveRawFile(
    file: Express.Multer.File,
    folder: string,
    allowedMimeTypes: string[],
    maxSizeMb = 5,
  ): Promise<{ url: string; relativePath: string }> {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new BadRequestException('File is too large');
    }

    const dir = path.join(process.cwd(), this.config.get<string>('uploads.dir')!, folder);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase() || '';
    const filename = `${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), file.buffer);

    const relativePath = `${folder}/${filename}`;
    return { url: `${this.config.get<string>('uploads.baseUrl')}/${relativePath}`, relativePath };
  }
}
