import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoStorageService } from '../../common/uploads/video-storage.service';
import {
  HOMEPAGE_VIDEO_KEYS,
  HomepageVideo,
  HomepageVideoSource,
  readHomepageVideo,
} from '../../common/utils/homepage-video';
import { AdminService } from './admin.service';
import { StartVideoUploadDto } from './dto/homepage-video.dto';

const DESCRIPTIONS = {
  [HOMEPAGE_VIDEO_KEYS.upload]:
    'Video uploaded from /admin/sadrzaj for the homepage "how it works" section, kept on the server disk (UPLOADS_DIR/videos), never in Object Storage',
  [HOMEPAGE_VIDEO_KEYS.source]:
    'Which homepage video shows when there are both a link and an uploaded video: "link" or "upload"',
};

/**
 * Administracija > Sadržaj > Video na početnoj: the link, the video uploaded
 * to this server and which of the two the homepage shows. The upload itself
 * (in parts, onto this server's disk) is VideoStorageService's.
 */
@Injectable()
export class HomepageVideoService {
  constructor(
    private prisma: PrismaService,
    private videos: VideoStorageService,
    private admin: AdminService,
  ) {}

  /** What the admin page shows; the poster's key reaches the browser as its URL. */
  async state() {
    return this.present(await this.read());
  }

  async setSource(adminId: string, source: HomepageVideoSource) {
    const before = await this.read();
    await this.write(HOMEPAGE_VIDEO_KEYS.source, source);
    await this.admin.logAction(adminId, 'update_setting', 'Setting', HOMEPAGE_VIDEO_KEYS.source, before.source, source);
    return this.state();
  }

  startUpload(adminId: string, dto: StartVideoUploadDto) {
    return this.videos.start(adminId, dto);
  }

  uploadStatus(adminId: string, id: string) {
    return this.videos.status(adminId, id);
  }

  writeChunk(adminId: string, id: string, offset: number, body: Readable, declaredLength?: number) {
    return this.videos.writeChunk(adminId, id, offset, body, declaredLength);
  }

  cancelUpload(adminId: string, id: string) {
    return this.videos.cancel(adminId, id);
  }

  /**
   * The finished upload becomes the homepage video (uploading one says so),
   * and the video it replaces is deleted from the disk at once.
   */
  async completeUpload(adminId: string, id: string) {
    const stored = await this.videos.complete(adminId, id);
    const before = await this.read();
    try {
      await this.prisma.$transaction([
        this.write(HOMEPAGE_VIDEO_KEYS.upload, stored as unknown as Prisma.InputJsonValue),
        this.write(HOMEPAGE_VIDEO_KEYS.source, 'upload'),
      ]);
    } catch (error) {
      await this.videos.remove(stored.file);
      throw error;
    }
    await this.admin.logAction(adminId, 'update_setting', 'Setting', HOMEPAGE_VIDEO_KEYS.upload, before.upload, stored);
    if (before.upload && before.upload.file !== stored.file) await this.videos.remove(before.upload.file);
    return this.state();
  }

  /** Deletes the uploaded video; the link, when there is one, shows again. */
  async removeUpload(adminId: string) {
    const before = await this.read();
    if (!before.upload) return this.present(before);
    await this.prisma.$transaction([
      // An empty string is the "none" the other homepage video settings use too.
      this.write(HOMEPAGE_VIDEO_KEYS.upload, ''),
      this.write(HOMEPAGE_VIDEO_KEYS.source, 'link'),
    ]);
    await this.admin.logAction(adminId, 'update_setting', 'Setting', HOMEPAGE_VIDEO_KEYS.upload, before.upload, null);
    await this.videos.remove(before.upload.file);
    return this.state();
  }

  private async read(): Promise<HomepageVideo> {
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: Object.values(HOMEPAGE_VIDEO_KEYS) } },
    });
    return readHomepageVideo(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
  }

  private present(video: HomepageVideo) {
    return {
      link: video.link,
      thumbnailUrl: video.poster,
      upload: video.upload,
      source: video.source,
      showing: video.showing,
    };
  }

  private write(key: keyof typeof DESCRIPTIONS, value: Prisma.InputJsonValue) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value, description: DESCRIPTIONS[key] },
      update: { value },
    });
  }
}
