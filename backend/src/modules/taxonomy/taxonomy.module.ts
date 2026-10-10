import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { AttributeAdminController } from './attribute-admin.controller';
import { AttributeAdminService } from './attribute-admin.service';

@Module({
  controllers: [TaxonomyController, AttributeAdminController],
  providers: [TaxonomyService, AttributeAdminService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
