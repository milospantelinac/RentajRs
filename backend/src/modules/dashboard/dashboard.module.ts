import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersModule } from '../users/users.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';

@Module({
  imports: [ReviewsModule, UsersModule, TaxonomyModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
