import { Prisma } from '@prisma/client';
import { resolveImageKeys } from './media-url.interceptor';

const BASE = 'http://localhost:3001/media';
const PHOTO = 'listings/0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001/photos/7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';
const AVATAR = 'users/0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001/avatar/7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';

describe('resolveImageKeys (T143)', () => {
  it('turns every image key in a response into the URL of its largest width', () => {
    const body = {
      results: [{ id: 'l1', coverPhoto: { id: 'p1', url: PHOTO, altText: null } }],
      owner: { avatarUrl: AVATAR },
    };
    expect(resolveImageKeys(body, BASE)).toEqual({
      results: [{ id: 'l1', coverPhoto: { id: 'p1', url: `${BASE}/${PHOTO}/1920.webp`, altText: null } }],
      owner: { avatarUrl: `${BASE}/${AVATAR}/400.webp` },
    });
  });

  it('never changes what it was given, and hands back untouched parts as they were', () => {
    const untouched = { title: 'Vikendica', tags: ['a', 'b'] };
    const body = { untouched, photo: { url: PHOTO } };
    const resolved = resolveImageKeys(body, BASE) as typeof body;
    expect(body.photo.url).toBe(PHOTO);
    expect(resolved.untouched).toBe(untouched);
    expect(resolveImageKeys(untouched, BASE)).toBe(untouched);
  });

  it('leaves other strings and non-plain values alone', () => {
    const sentAt = new Date('2026-10-11T10:00:00Z');
    const price = new Prisma.Decimal('12.5');
    const body = {
      avatarUrl: 'https://lh3.googleusercontent.com/a/photo',
      old: 'http://localhost:3001/uploads/avatars/7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10.webp',
      text: `see ${PHOTO}`,
      sentAt,
      price,
      count: 3,
      none: null,
    };
    const resolved = resolveImageKeys(body, BASE) as typeof body;
    expect(resolved).toBe(body);
    expect(resolved.sentAt).toBe(sentAt);
    expect(resolved.price).toBe(price);
  });
});
