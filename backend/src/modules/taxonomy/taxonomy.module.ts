import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { AttributeAdminController } from './attribute-admin.controller';
import { AttributeAdminService } from './attribute-admin.service';
import { BookingModelAdminController } from './booking-model-admin.controller';
import { BookingModelAdminService } from './booking-model-admin.service';

@Module({
  controllers: [TaxonomyController, AttributeAdminController, BookingModelAdminController],
  providers: [TaxonomyService, AttributeAdminService, BookingModelAdminService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
