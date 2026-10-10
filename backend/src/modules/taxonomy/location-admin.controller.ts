import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { LocationAdminService } from './location-admin.service';
import {
  AdminCitiesQueryDto,
  CreateAreaDto,
  CreateCityDto,
  CreateRegionDto,
  UpdateAreaDto,
  UpdateCityDto,
  UpdateRegionDto,
} from './dto/location-admin.dto';

/** T119: Administracija > Lokacije, under the same permission as the categories. */
@ApiTags('taxonomy')
@RequirePermissions('manage_categories')
@Controller('admin/locations')
export class LocationAdminController {
  constructor(private locations: LocationAdminService) {}

  @Get('regions')
  regions() {
    return this.locations.regions();
  }

  @Post('regions')
  createRegion(@CurrentUser('id') adminId: string, @Body() dto: CreateRegionDto) {
    return this.locations.createRegion(adminId, dto);
  }

  @Patch('regions/:id')
  updateRegion(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.locations.updateRegion(adminId, id, dto);
  }

  @Delete('regions/:id')
  deleteRegion(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.locations.deleteRegion(adminId, id);
  }

  @Get('cities')
  cities(@Query() query: AdminCitiesQueryDto) {
    return this.locations.cities(query);
  }

  @Post('cities')
  createCity(@CurrentUser('id') adminId: string, @Body() dto: CreateCityDto) {
    return this.locations.createCity(adminId, dto);
  }

  @Get('history')
  history() {
    return this.locations.history();
  }

  @Get('cities/:id')
  city(@Param('id') id: string) {
    return this.locations.city(id);
  }

  @Get('cities/:id/history')
  cityHistory(@Param('id') id: string) {
    return this.locations.history(id);
  }

  @Patch('cities/:id')
  updateCity(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.locations.updateCity(adminId, id, dto);
  }

  @Delete('cities/:id')
  deleteCity(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.locations.deleteCity(adminId, id);
  }

  @Post('cities/:id/areas')
  createArea(@CurrentUser('id') adminId: string, @Param('id') cityId: string, @Body() dto: CreateAreaDto) {
    return this.locations.createArea(adminId, cityId, dto);
  }

  @Patch('areas/:id')
  updateArea(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.locations.updateArea(adminId, id, dto);
  }

  @Delete('areas/:id')
  deleteArea(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.locations.deleteArea(adminId, id);
  }
}
