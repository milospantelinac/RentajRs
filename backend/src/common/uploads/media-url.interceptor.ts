import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { StorageService } from './storage.service';
import { imageKindOf, imageUrl } from './media';

/**
 * T143: the database keeps image keys (media.ts), the API hands out URLs.
 * Every JSON response passes through here, so a photo, avatar, category
 * picture or poster read anywhere (cards, the listing page, messages, admin)
 * reaches the browser as the address of its largest width, and no service has
 * to remember to convert it. Only strings shaped exactly like an image key
 * change; the frontend's utils/media.js picks smaller widths from the URL.
 */
@Injectable()
export class MediaUrlInterceptor implements NestInterceptor {
  constructor(private storage: StorageService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const base = this.storage.publicBaseUrl;
    if (!base) return next.handle();
    return next.handle().pipe(map((body) => resolveImageKeys(body, base)));
  }
}

/**
 * A copy of `value` with image keys replaced by URLs. Objects and arrays
 * without a key in them come back as they were (cached rows are never
 * changed in place); class instances (Date, Decimal, Buffer) are left alone.
 */
export function resolveImageKeys(value: unknown, base: string): unknown {
  if (typeof value === 'string') return imageKindOf(value) ? imageUrl(base, value) : value;
  if (Array.isArray(value)) {
    let copy: unknown[] | null = null;
    value.forEach((item, index) => {
      const resolved = resolveImageKeys(item, base);
      if (resolved !== item) {
        copy ??= [...value];
        copy[index] = resolved;
      }
    });
    return copy ?? value;
  }
  if (isPlainObject(value)) {
    let copy: Record<string, unknown> | null = null;
    for (const [key, item] of Object.entries(value)) {
      const resolved = resolveImageKeys(item, base);
      if (resolved !== item) {
        copy ??= { ...value };
        copy[key] = resolved;
      }
    }
    return copy ?? value;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
