import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchListingsDto } from './dto/search-listings.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Public()
  @Post()
  search(@Body() dto: SearchListingsDto) {
    return this.searchService.search(dto);
  }

  @Public()
  @Get('filters')
  getFilters(@Query('categorySlug') categorySlug: string) {
    return this.searchService.getFilterableAttributes(categorySlug);
  }

  @Public()
  @Get('sitemap-urls')
  getSitemapUrls() {
    return this.searchService.getSitemapUrls();
  }

  @Public()
  @Get('indexed-cities')
  getIndexedCitiesForCategory(@Query('categorySlug') categorySlug: string) {
    return this.searchService.getIndexedCitiesForCategory(categorySlug);
  }

  @Public()
  @Post('relaxed')
  relaxedSearch(@Body() dto: SearchListingsDto) {
    return this.searchService.relaxedSearch(dto);
  }

  @Public()
  @Post('notify-empty')
  recordEmptySearch(@Body() body: { search: SearchListingsDto; email?: string }) {
    return this.searchService.recordEmptySearch(body.search, body.email);
  }
}
