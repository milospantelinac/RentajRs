import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { ContentService } from './content.service';
import { Public } from '../../common/decorators/public.decorator';

function resolveLanguage(xLang?: string): Language {
  return (xLang || 'sr').toUpperCase() === 'EN' ? Language.EN : Language.SR;
}

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Public()
  @Get('static-pages/:slug')
  getStaticPage(@Param('slug') slug: string, @Headers('x-lang') xLang?: string) {
    return this.contentService.getStaticPage(slug, resolveLanguage(xLang));
  }

  @Public()
  @Get('faqs')
  listFaqs(@Headers('x-lang') xLang?: string) {
    return this.contentService.listFaqs(resolveLanguage(xLang));
  }

  @Public()
  @Get('homepage-video-url')
  getHomepageVideoUrl() {
    return this.contentService.getHomepageVideoUrl();
  }
}
