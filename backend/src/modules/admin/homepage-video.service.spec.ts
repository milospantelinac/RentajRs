import { HomepageVideoService } from './homepage-video.service';
import { ContentService } from '../content/content.service';

const ADMIN = 'a0000000-0000-4000-8000-000000000001';
const OLD = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001.mp4';
const NEW = '7d3c3f0e-1c9f-4b7a-a0d4-6bfa2b0f2a10.mp4';
const LINK = 'https://www.youtube.com/watch?v=2PuFyjAs7JA';
const POSTER = 'site/homepage/video-poster/5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

function stored(file: string) {
  return { file, name: 'vodic.mp4', size: 10, type: 'video/mp4', codecs: ['avc1', 'mp4a'], uploadedAt: '2026-11-18T12:00:00.000Z' };
}

/** A Setting table in memory, enough for findMany, upsert and $transaction. */
function settingsTable(initial: Record<string, unknown>) {
  const rows = new Map(Object.entries(initial));
  const prisma = {
    setting: {
      findMany: jest.fn(async ({ where }: any) =>
        [...rows].filter(([key]) => where.key.in.includes(key)).map(([key, value]) => ({ key, value })),
      ),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        rows.set(where.key, rows.has(where.key) ? update.value : create.value);
      }),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return { rows, prisma };
}

function setup(initial: Record<string, unknown>) {
  const { rows, prisma } = settingsTable(initial);
  const videos = { complete: jest.fn(async () => stored(NEW)), remove: jest.fn(async () => undefined) };
  const admin = { logAction: jest.fn(async () => undefined) };
  const service = new HomepageVideoService(prisma as any, videos as any, admin as any);
  const content = new ContentService(prisma as any, {} as any);
  return { rows, prisma, videos, admin, service, content };
}

describe('HomepageVideoService (Administracija > Sadržaj > Video na početnoj)', () => {
  it('makes a finished upload the homepage video and deletes the one it replaces', async () => {
    const { rows, videos, admin, service, content } = setup({
      homepage_video_url: LINK,
      homepage_video_upload: stored(OLD),
      homepage_video_source: 'link',
    });

    const state = await service.completeUpload(ADMIN, 'upload-id');

    expect(state).toMatchObject({ link: LINK, upload: { file: NEW }, source: 'upload', showing: 'upload' });
    expect(rows.get('homepage_video_source')).toBe('upload');
    expect(videos.remove).toHaveBeenCalledWith(OLD);
    expect(videos.remove).not.toHaveBeenCalledWith(NEW);
    expect(admin.logAction).toHaveBeenCalledWith(ADMIN, 'update_setting', 'Setting', 'homepage_video_upload', expect.objectContaining({ file: OLD }), stored(NEW));
    expect(await content.getHomepageVideoUrl()).toEqual({
      url: null,
      thumbnailUrl: null,
      file: { path: `/videos/${NEW}`, type: 'video/mp4' },
    });
  });

  it('deletes the new file again when the setting cannot be saved, and keeps the old one', async () => {
    const { prisma, videos, service } = setup({ homepage_video_upload: stored(OLD) });
    prisma.$transaction.mockRejectedValueOnce(new Error('database down'));

    await expect(service.completeUpload(ADMIN, 'upload-id')).rejects.toThrow('database down');
    expect(videos.remove).toHaveBeenCalledWith(NEW);
    expect(videos.remove).not.toHaveBeenCalledWith(OLD);
  });

  it('removes the uploaded video, and the link shows again', async () => {
    const { rows, videos, service, content } = setup({
      homepage_video_url: LINK,
      homepage_video_thumbnail: POSTER,
      homepage_video_upload: stored(OLD),
      homepage_video_source: 'upload',
    });

    const state = await service.removeUpload(ADMIN);

    expect(state).toMatchObject({ upload: null, source: 'link', showing: 'link' });
    expect(rows.get('homepage_video_upload')).toBe('');
    expect(videos.remove).toHaveBeenCalledWith(OLD);
    expect(await content.getHomepageVideoUrl()).toEqual({ url: LINK, thumbnailUrl: POSTER, file: null });
  });

  it('switches between the link and the upload when there are both', async () => {
    const { admin, service, content } = setup({ homepage_video_url: LINK, homepage_video_upload: stored(OLD) });

    expect((await service.state()).showing).toBe('upload');
    expect((await service.setSource(ADMIN, 'link')).showing).toBe('link');
    expect(admin.logAction).toHaveBeenCalledWith(ADMIN, 'update_setting', 'Setting', 'homepage_video_source', 'upload', 'link');
    expect((await content.getHomepageVideoUrl()).url).toBe(LINK);
  });
});
