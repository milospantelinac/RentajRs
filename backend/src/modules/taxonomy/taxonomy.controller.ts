import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { ProposeCategoryDto } from './dto/propose-category.dto';
import {
  CreateCategoryDto,
  MergeCategoryDto,
  RejectCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
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

  /** T129: where an old category URL (merge, a new slug) leads now; newPath null when it does not move. */
  @Public()
  @Get('redirects/resolve')
  resolveRedirect(@Query('path') path: string) {
    return this.taxonomyService.resolveRedirect(path);
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

  // Declared before admin/categories/:id so "reorder" is not read as an id.
  @RequirePermissions('manage_categories')
  @Patch('admin/categories/reorder')
  adminReorder(@CurrentUser('id') adminId: string, @Body() dto: ReorderCategoriesDto) {
    return this.taxonomyService.adminReorderCategories(adminId, dto);
  }

  @RequirePermissions('manage_categories')
  @Get('admin/categories/:id')
  adminGetOne(@Param('id') id: string) {
    return this.taxonomyService.adminGetCategory(id);
  }

  @RequirePermissions('manage_categories')
  @Get('admin/categories/:id/history')
  adminHistory(@Param('id') id: string) {
    return this.taxonomyService.adminCategoryHistory(id);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/image')
  @UseInterceptors(FileInterceptor('file'))
  adminSetImage(@CurrentUser('id') adminId: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.taxonomyService.adminSetCategoryImage(adminId, id, file);
  }

  @RequirePermissions('manage_categories')
  @Delete('admin/categories/:id/image')
  adminRemoveImage(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.taxonomyService.adminRemoveCategoryImage(adminId, id);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories')
  adminCreate(@CurrentUser('id') adminId: string, @Body() dto: CreateCategoryDto) {
    return this.taxonomyService.adminCreateCategory(adminId, dto);
  }

  @RequirePermissions('manage_categories')
  @Patch('admin/categories/:id')
  adminUpdate(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.taxonomyService.adminUpdateCategory(adminId, id, dto);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/approve')
  adminApprove(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.taxonomyService.adminApproveCategory(adminId, id);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/reject')
  adminReject(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: RejectCategoryDto) {
    return this.taxonomyService.adminRejectCategory(adminId, id, dto);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/merge')
  adminMerge(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: MergeCategoryDto) {
    return this.taxonomyService.adminMergeCategory(adminId, id, dto);
  }

  @RequirePermissions('manage_categories')
  @Post('admin/categories/:id/promote')
  adminPromote(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.taxonomyService.adminPromoteCategory(adminId, id);
  }

  @RequirePermissions('manage_categories')
  @Delete('admin/categories/:id')
  adminDeleteCategory(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.taxonomyService.adminDeleteCategory(adminId, id);
  }
}
