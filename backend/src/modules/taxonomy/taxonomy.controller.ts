import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { ProposeCategoryDto } from './dto/propose-category.dto';
import {
  CreateCategoryDto,
  MergeCategoryDto,
  RejectCategoryDto,
  UpdateCategoryDto,
  UpsertAttributeDto,
} from './dto/admin-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('taxonomy')
@Controller()
export class TaxonomyController {
  constructor(private taxonomyService: TaxonomyService) {}

  // -- Public --------------------------------------------------------------

  @Public()
  @Get('categories')
  getTree() {
    return this.taxonomyService.getCategoryTree();
  }

  @Public()
  @Get('categories/check-duplicate')
  checkDuplicate(@Query('parentId') parentId: string, @Query('name') name: string) {
    return this.taxonomyService.checkDuplicateCategory(parentId, name);
  }

  @Public()
  @Get('categories/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.taxonomyService.getCategoryBySlug(slug);
  }

  @Public()
  @Get('locations/regions')
  getRegions() {
    return this.taxonomyService.getRegions();
  }

  @Public()
  @Get('locations/cities')
  getCities(@Query('regionId') regionId?: string) {
    return this.taxonomyService.getCities(regionId);
  }

  @Public()
  @Get('locations/cities/:citySlug/areas')
  getCityAreas(@Param('citySlug') citySlug: string) {
    return this.taxonomyService.getCityAreas(citySlug);
  }

  // -- Authenticated users ---------------------------------------------

  @Post('categories/propose')
  proposeCategory(@CurrentUser('id') userId: string, @Body() dto: ProposeCategoryDto) {
    return this.taxonomyService.proposeCategory(userId, dto);
  }

  // -- Admin -----------------------------------------------------------

  @RequirePermissions('manage_categories')
  @Get('admin/categories')
  adminGetTree() {
    return this.taxonomyService.adminGetCategoryTree();
  }

  @RequirePermissions('manage_categories')
  @Get('admin/categories/proposed')
  adminListProposed() {
    return this.taxonomyService.adminListProposedCategories();
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories')
  adminCreate(@Body() dto: CreateCategoryDto) {
    return this.taxonomyService.adminCreateCategory(dto);
  }

  @RequirePermissions('manage_categories')
  @Patch('admin/categories/:id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.taxonomyService.adminUpdateCategory(id, dto);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/approve')
  adminApprove(@Param('id') id: string) {
    return this.taxonomyService.adminApproveCategory(id);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/reject')
  adminReject(@Param('id') id: string, @Body() dto: RejectCategoryDto) {
    return this.taxonomyService.adminRejectCategory(id, dto);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/merge')
  adminMerge(@Param('id') id: string, @Body() dto: MergeCategoryDto) {
    return this.taxonomyService.adminMergeCategory(id, dto);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/promote')
  adminPromote(@Param('id') id: string) {
    return this.taxonomyService.adminPromoteCategory(id);
  }

  @RequirePermissions('manage_categories')
  @Delete('admin/categories/:id')
  adminDeleteCategory(@Param('id') id: string) {
    return this.taxonomyService.adminDeleteCategory(id);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/attributes')
  adminUpsertAttribute(@Param('id') id: string, @Body() dto: UpsertAttributeDto) {
    return this.taxonomyService.adminUpsertAttribute(id, dto);
  }

  @RequirePermissions('manage_categories')
  @Delete('admin/attributes/:attributeId')
  adminDeleteAttribute(@Param('attributeId') attributeId: string) {
    return this.taxonomyService.adminDeleteAttribute(attributeId);
  }
}
