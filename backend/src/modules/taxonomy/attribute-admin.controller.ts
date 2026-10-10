import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AttributeAdminService } from './attribute-admin.service';
import {
  CreateAttributeDto,
  CreateFilterDto,
  CreateOptionDto,
  ReorderIdsDto,
  SetFactKeysDto,
  UpdateAttributeDto,
  UpdateFilterDto,
  UpdateOptionDto,
} from './dto/attribute-admin.dto';

/** T129 part 2: fields, amenities, search filters and key facts of a category (Administracija > Kategorije). */
@ApiTags('taxonomy')
@RequirePermissions('manage_categories')
@Controller('admin')
export class AttributeAdminController {
  constructor(private attributes: AttributeAdminService) {}

  @Get('categories/:id/attributes')
  list(@Param('id') id: string) {
    return this.attributes.listAttributes(id);
  }

  @Post('categories/:id/attributes')
  create(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: CreateAttributeDto) {
    return this.attributes.createAttribute(adminId, id, dto);
  }

  @Patch('categories/:id/attributes/reorder')
  reorder(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: ReorderIdsDto) {
    return this.attributes.reorderAttributes(adminId, id, dto);
  }

  @Put('categories/:id/facts')
  setFacts(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: SetFactKeysDto) {
    return this.attributes.setFactKeys(adminId, id, dto);
  }

  @Patch('attributes/:id')
  update(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributes.updateAttribute(adminId, id, dto);
  }

  @Delete('attributes/:id')
  remove(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.attributes.deleteAttribute(adminId, id);
  }

  @Post('attributes/:id/options')
  createOption(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: CreateOptionDto) {
    return this.attributes.createOption(adminId, id, dto);
  }

  @Patch('attributes/:id/options/reorder')
  reorderOptions(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: ReorderIdsDto) {
    return this.attributes.reorderOptions(adminId, id, dto);
  }

  @Patch('options/:id')
  updateOption(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateOptionDto) {
    return this.attributes.updateOption(adminId, id, dto);
  }

  @Delete('options/:id')
  removeOption(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.attributes.deleteOption(adminId, id);
  }

  @Get('categories/:id/filters')
  listFilters(@Param('id') id: string) {
    return this.attributes.listFilters(id);
  }

  @Post('categories/:id/filters')
  createFilter(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: CreateFilterDto) {
    return this.attributes.createFilter(adminId, id, dto);
  }

  @Patch('categories/:id/filters/reorder')
  reorderFilters(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: ReorderIdsDto) {
    return this.attributes.reorderFilters(adminId, id, dto);
  }

  @Patch('filters/:id')
  updateFilter(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateFilterDto) {
    return this.attributes.updateFilter(adminId, id, dto);
  }

  @Delete('filters/:id')
  removeFilter(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.attributes.deleteFilter(adminId, id);
  }
}
