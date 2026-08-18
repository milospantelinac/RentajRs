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

  async getHomepageVideoUrl() {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'homepage_video_url' } });
    const url = setting?.value;
    return { url: typeof url === 'string' && url.trim() ? url.trim() : null };
  }
}
