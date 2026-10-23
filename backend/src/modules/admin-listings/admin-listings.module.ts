import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';

@Module({
  imports: [ListingsModule, SubscriptionsModule, TaxonomyModule],
  controllers: [AdminListingsController],
  providers: [AdminListingsService],
})
export class AdminListingsModule {}
