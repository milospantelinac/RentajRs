import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { AttributeAdminController } from './attribute-admin.controller';
import { AttributeAdminService } from './attribute-admin.service';
import { BookingModelAdminController } from './booking-model-admin.controller';
import { BookingModelAdminService } from './booking-model-admin.service';
import { LocationsService } from './locations.service';
import { LocationAdminController } from './location-admin.controller';
import { LocationAdminService } from './location-admin.service';

@Module({
  controllers: [TaxonomyController, AttributeAdminController, BookingModelAdminController, LocationAdminController],
  providers: [TaxonomyService, AttributeAdminService, BookingModelAdminService, LocationsService, LocationAdminService],
  exports: [TaxonomyService, LocationsService],
})
export class TaxonomyModule {}
