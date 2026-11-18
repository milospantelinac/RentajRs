import { Injectable, NotFoundException } from '@nestjs/common';
import { Language } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { HOMEPAGE_VIDEO_KEYS, readHomepageVideo } from '../../common/utils/homepage-video';

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private i18n: I18nService,
  ) {}

  async getStaticPage(slug: string, language: Language) {
    const page = await this.prisma.staticPage.findUnique({ where: { slug_language: { slug, language } } });
    if (!page || !page.published) throw new NotFoundException(this.i18n.t('errors.PAGE_NOT_FOUND'));
    return page;
  }

  async listFaqs(language: Language) {
    return this.prisma.faq.findMany({
      where: { language, published: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, question: true, answer: true },
    });
  }

  /**
   * The homepage "how it works" block: the video itself plus the poster the
   * admin uploaded for it. Without a poster the frontend falls back to
   * YouTube's own thumbnail (or the uploaded video's first frame), so the
   * block still renders.
   *
   * The video is either the link (`url`) or the file an admin uploaded to
   * this server (`file`, its path under the API base, /videos/{fileId}.mp4),
   * never both: when there are both, the one the admin chose.
   */
  async getHomepageVideoUrl() {
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: Object.values(HOMEPAGE_VIDEO_KEYS) } },
    });
    const video = readHomepageVideo(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
    return {
      url: video.showing === 'link' ? video.link : null,
      thumbnailUrl: video.poster,
      file:
        video.showing === 'upload' && video.upload
          ? { path: `/videos/${video.upload.file}`, type: video.upload.type }
          : null,
    };
  }
}
