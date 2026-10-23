import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { FeaturedModule } from '../featured/featured.module';

@Module({
  imports: [TaxonomyModule, FeaturedModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
