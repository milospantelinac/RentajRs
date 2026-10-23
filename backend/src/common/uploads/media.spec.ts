import {
  attachmentKey,
  attributeIconKeyIn,
  imageFileNames,
  imageFolderOf,
  imageKeyOf,
  imageKindOf,
  imageUrl,
  isAttachmentKey,
  newImageKey,
} from './media';

const L = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001';
const F = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10';
const BASE = 'https://rentaj-prod-media.fsn1.your-objectstorage.com';

describe('media keys (T143)', () => {
  it('builds one folder per picture under the record it belongs to', () => {
    expect(newImageKey({ kind: 'listingPhoto', listingId: L }, F)).toBe(`listings/${L}/photos/${F}`);
    expect(newImageKey({ kind: 'avatar', userId: L }, F)).toBe(`users/${L}/avatar/${F}`);
    expect(newImageKey({ kind: 'categoryImage', categoryId: L }, F)).toBe(`categories/${L}/${F}`);
    expect(newImageKey({ kind: 'homepagePoster' }, F)).toBe(`site/homepage/video-poster/${F}`);
    expect(newImageKey({ kind: 'listingPhoto', listingId: L })).toMatch(new RegExp(`^listings/${L}/photos/[0-9a-f-]{36}$`));
  });

  it('tells a key from everything else', () => {
    expect(imageKindOf(`listings/${L}/photos/${F}`)).toBe('listingPhoto');
    expect(imageKindOf(`users/${L}/avatar/${F}`)).toBe('avatar');
    expect(imageKindOf(`categories/${L}/${F}`)).toBe('categoryImage');
    expect(imageKindOf(`site/homepage/video-poster/${F}`)).toBe('homepagePoster');
    expect(imageKindOf('https://lh3.googleusercontent.com/a/photo')).toBeNull();
    expect(imageKindOf(`http://localhost:3001/uploads/listings/${L}/${F}.webp`)).toBeNull();
    expect(imageKindOf(`listings/${L}/photos/${F}/800.webp`)).toBeNull();
    expect(imageKindOf(`listings/${L}/photos/not-a-uuid`)).toBeNull();
    expect(imageKindOf(null)).toBeNull();
  });

  it('keeps the icons uploaded for fields and amenity items apart from any record (T129)', () => {
    const key = `site/attribute-icons/${F}`;
    expect(newImageKey({ kind: 'attributeIcon' }, F)).toBe(key);
    expect(imageKindOf(key)).toBe('attributeIcon');
    expect(imageUrl(BASE, key)).toBe(`${BASE}/${key}/128.webp`);
    expect(imageFileNames('attributeIcon')).toEqual(['128.webp', 'master.webp']);
    // The panel sends the URL it was shown back on a save; any base gives the key.
    expect(attributeIconKeyIn(key)).toBe(key);
    expect(attributeIconKeyIn(`${BASE}/${key}/128.webp`)).toBe(key);
    expect(attributeIconKeyIn(`http://127.0.0.1:3335/media/${key}/128.webp`)).toBe(key);
    expect(attributeIconKeyIn('bazen')).toBeNull();
    expect(attributeIconKeyIn(`categories/${L}/${F}`)).toBeNull();
  });

  it('names the widths and, where kept, the master', () => {
    expect(imageFileNames('listingPhoto')).toEqual(['400.webp', '800.webp', '1280.webp', '1920.webp', 'master.webp']);
    expect(imageFileNames('avatar')).toEqual(['128.webp', '400.webp']);
  });

  it('hands out the largest width unless another one is asked for', () => {
    const key = `listings/${L}/photos/${F}`;
    expect(imageUrl(BASE, key)).toBe(`${BASE}/${key}/1920.webp`);
    expect(imageUrl(BASE, key, 800)).toBe(`${BASE}/${key}/800.webp`);
    expect(imageUrl(BASE, key, 333)).toBe(`${BASE}/${key}/1920.webp`);
    expect(imageUrl(BASE, `users/${L}/avatar/${F}`)).toBe(`${BASE}/users/${L}/avatar/${F}/400.webp`);
  });

  it('finds the key behind one of our own URLs, and nothing behind anything else', () => {
    const key = `site/homepage/video-poster/${F}`;
    expect(imageKeyOf(key, BASE)).toBe(key);
    expect(imageKeyOf(`${BASE}/${key}/1600.webp`, BASE)).toBe(key);
    expect(imageKeyOf(`${BASE}/${key}/master.webp`, BASE)).toBe(key);
    expect(imageKeyOf(`https://elsewhere.example/${key}/1600.webp`, BASE)).toBeNull();
    expect(imageKeyOf('https://lh3.googleusercontent.com/a/photo', BASE)).toBeNull();
    expect(imageKeyOf(undefined, BASE)).toBeNull();
  });

  it('gives the folder of a stored file', () => {
    expect(imageFolderOf(`listings/${L}/photos/${F}/400.webp`)).toBe(`listings/${L}/photos/${F}`);
    expect(imageFolderOf(`site/storage-check/${F}/check.txt`)).toBeNull();
  });

  it('keys an attachment by its conversation, message and own id', () => {
    const key = attachmentKey(L, F, L, 'pdf');
    expect(key).toBe(`conversations/${L}/${F}/${L}.pdf`);
    expect(isAttachmentKey(key)).toBe(true);
    expect(isAttachmentKey(`conversations/${L}/${F}/${L}.html`)).toBe(false);
    expect(isAttachmentKey(`conversations/${L}/../${L}.pdf`)).toBe(false);
  });
});
