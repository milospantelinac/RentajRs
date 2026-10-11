import { randomUUID } from 'crypto';

/**
 * T143: where every uploaded file lives in Object Storage, in one place.
 *
 * Public images (the public bucket on the server, UPLOADS_DIR/media on a
 * developer's machine, see StorageService) are folders keyed by the record
 * whose lifetime they share, one folder per uploaded image, one file per
 * width plus the master the widths are made from:
 *
 *   listings/{listingId}/photos/{fileId}/master.webp, 1920.webp ... 400.webp
 *   users/{userId}/avatar/{fileId}/400.webp, 128.webp
 *   categories/{categoryId}/{fileId}/master.webp, 1600.webp ... 400.webp
 *   site/homepage/video-poster/{fileId}/master.webp, 1600.webp, 800.webp
 *
 * The database holds the folder (the "key"), never a URL, so moving the
 * files behind another domain or a CDN is an environment change. Message
 * attachments are private (the private bucket, UPLOADS_DIR/private), one file each:
 *
 *   conversations/{conversationId}/{messageId}/{attachmentId}.webp | .pdf
 *
 * Names are random and never reused, which is what lets the public files be
 * cached for a year.
 */

export type ImageKind = 'listingPhoto' | 'avatar' | 'categoryImage' | 'homepagePoster';

export type ImageTarget =
  | { kind: 'listingPhoto'; listingId: string }
  | { kind: 'avatar'; userId: string }
  | { kind: 'categoryImage'; categoryId: string }
  | { kind: 'homepagePoster' };

export interface ImageProfile {
  /** Longest side of the master copy; null keeps none (an avatar arrives cropped to its final size). */
  master: number | null;
  /** Display widths, smallest first; the last one is what the API hands out. */
  widths: number[];
  /** Bounds both sides by the width (an avatar is a square), not only the width. */
  boxed: boolean;
}

// The frontend's utils/media.js names the same widths; change both together.
export const IMAGE_PROFILES: Record<ImageKind, ImageProfile> = {
  // Cards, the listing page and phones (user, 2026-10-11).
  listingPhoto: { master: 2560, widths: [400, 800, 1280, 1920], boxed: false },
  // Shown from 32 to 96 px; the crop dialog uploads 400 x 400.
  avatar: { master: null, widths: [128, 400], boxed: true },
  categoryImage: { master: 2560, widths: [400, 800, 1600], boxed: false },
  homepagePoster: { master: 2560, widths: [800, 1600], boxed: false },
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const IMAGE_KEY_PATTERNS: Array<[ImageKind, RegExp]> = [
  ['listingPhoto', new RegExp(`^listings/${UUID}/photos/${UUID}$`)],
  ['avatar', new RegExp(`^users/${UUID}/avatar/${UUID}$`)],
  ['categoryImage', new RegExp(`^categories/${UUID}/${UUID}$`)],
  ['homepagePoster', new RegExp(`^site/homepage/video-poster/${UUID}$`)],
];

const ATTACHMENT_KEY = new RegExp(`^conversations/${UUID}/${UUID}/${UUID}\\.(webp|pdf)$`);

export function newImageKey(target: ImageTarget, fileId: string = randomUUID()): string {
  switch (target.kind) {
    case 'listingPhoto':
      return `listings/${target.listingId}/photos/${fileId}`;
    case 'avatar':
      return `users/${target.userId}/avatar/${fileId}`;
    case 'categoryImage':
      return `categories/${target.categoryId}/${fileId}`;
    case 'homepagePoster':
      return `site/homepage/video-poster/${fileId}`;
  }
}

export function attachmentKey(conversationId: string, messageId: string, attachmentId: string, extension: 'webp' | 'pdf') {
  return `conversations/${conversationId}/${messageId}/${attachmentId}.${extension}`;
}

/** Which kind of image a stored key is, or null for anything else (a URL, a Google avatar, an attachment). */
export function imageKindOf(value: unknown): ImageKind | null {
  if (typeof value !== 'string') return null;
  for (const [kind, pattern] of IMAGE_KEY_PATTERNS) {
    if (pattern.test(value)) return kind;
  }
  return null;
}

export function isAttachmentKey(value: unknown): value is string {
  return typeof value === 'string' && ATTACHMENT_KEY.test(value);
}

/** The files one image folder holds: the widths, then the master. */
export function imageFileNames(kind: ImageKind): string[] {
  const profile = IMAGE_PROFILES[kind];
  return [...profile.widths.map((width) => `${width}.webp`), ...(profile.master ? ['master.webp'] : [])];
}

/** Public URL of an image key at one of its widths (the largest unless asked). */
export function imageUrl(publicBaseUrl: string, key: string, width?: number): string {
  const kind = imageKindOf(key);
  const widths = kind ? IMAGE_PROFILES[kind].widths : [];
  const chosen = width && widths.includes(width) ? width : widths[widths.length - 1];
  return `${publicBaseUrl}/${key}/${chosen}.webp`;
}

/**
 * The image key behind a stored value. A key is itself; one of our own public
 * URLs (an admin can save a setting back with the URL the API showed) gives
 * its folder. Anything else (a Google avatar, a photo not moved yet) is null.
 */
export function imageKeyOf(value: unknown, publicBaseUrl: string): string | null {
  if (typeof value !== 'string') return null;
  if (imageKindOf(value)) return value;
  if (!publicBaseUrl || !value.startsWith(`${publicBaseUrl}/`)) return null;
  const folder = value.slice(publicBaseUrl.length + 1).replace(/\/(?:\d+|master)\.webp$/, '');
  return imageKindOf(folder) ? folder : null;
}

/** Folder of an object inside the public bucket ("listings/x/photos/y/800.webp" -> "listings/x/photos/y"). */
export function imageFolderOf(objectKey: string): string | null {
  const folder = objectKey.replace(/\/[^/]+$/, '');
  return imageKindOf(folder) ? folder : null;
}
