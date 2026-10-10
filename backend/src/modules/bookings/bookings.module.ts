import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingChangesService } from './booking-changes.service';
import { AvailabilityModule } from '../availability/availability.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';

@Module({
  imports: [AvailabilityModule, TaxonomyModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingChangesService],
  exports: [BookingsService],
})
export class BookingsModule {}
