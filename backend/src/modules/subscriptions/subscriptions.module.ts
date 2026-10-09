import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ListingsModule } from '../listings/listings.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';

@Module({
  imports: [ListingsModule, TaxonomyModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
