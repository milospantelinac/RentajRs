import { Injectable, NotFoundException } from '@nestjs/common';
import { Language } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';

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
   * YouTube's own thumbnail, so the block still renders.
   */
  async getHomepageVideoUrl() {
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: ['homepage_video_url', 'homepage_video_thumbnail'] } },
    });
    const read = (key: string) => {
      const value = settings.find((s) => s.key === key)?.value;
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    };
    return { url: read('homepage_video_url'), thumbnailUrl: read('homepage_video_thumbnail') };
  }
}
