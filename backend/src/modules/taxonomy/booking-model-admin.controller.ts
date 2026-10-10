import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { BookingModelAdminService } from './booking-model-admin.service';
import { ReorderModelsDto, SetCategoryModelsDto, UpdateBookingModelDto } from './dto/booking-model-admin.dto';

/** T129 parts 3 and 4: Administracija > Rezervacioni modeli. */
@ApiTags('taxonomy')
@RequirePermissions('manage_categories')
@Controller('admin')
export class BookingModelAdminController {
  constructor(private models: BookingModelAdminService) {}

  @Get('booking-models')
  overview() {
    return this.models.overview();
  }

  @Get('booking-models/history')
  history() {
    return this.models.history();
  }

  // Declared before booking-models/:key so "reorder" is not read as a key.
  @Patch('booking-models/reorder')
  reorder(@CurrentUser('id') adminId: string, @Body() dto: ReorderModelsDto) {
    return this.models.reorderModels(adminId, dto);
  }

  @Patch('booking-models/:key')
  update(@CurrentUser('id') adminId: string, @Param('key') key: string, @Body() dto: UpdateBookingModelDto) {
    return this.models.updateModel(adminId, key, dto);
  }

  @Put('categories/:id/booking-models')
  setCategoryModels(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: SetCategoryModelsDto) {
    return this.models.setCategoryModels(adminId, id, dto);
  }
}
