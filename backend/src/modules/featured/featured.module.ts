import { Module } from '@nestjs/common';
import { FeaturedController } from './featured.controller';
import { FeaturedService } from './featured.service';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';

/** Istaknuti oglasi (T129 point 6): see FeaturedService. SearchModule imports it for the top of a search. */
@Module({
  imports: [TaxonomyModule],
  controllers: [FeaturedController],
  providers: [FeaturedService],
  exports: [FeaturedService],
})
export class FeaturedModule {}
