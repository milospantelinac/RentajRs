import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { FeaturedModule } from '../featured/featured.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TaxonomyModule, UsersModule, FeaturedModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
