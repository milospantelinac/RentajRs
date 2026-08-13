import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpsertAttributesDto } from './dto/upsert-attributes.dto';
import { UpsertFaqsDto } from './dto/upsert-faqs.dto';
import { UpsertExtraServicesDto } from './dto/upsert-extra-services.dto';
import { RejectListingDto, RejectVersionDto } from './dto/reject-listing.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('listings')
@Controller()
export class ListingsController {
  constructor(private listingsService: ListingsService) {}

  @Post('listings')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateListingDto) {
    return this.listingsService.createDraft(userId, dto);
  }

  @Get('listings/mine')
  getMine(@CurrentUser('id') userId: string) {
    return this.listingsService.getMine(userId);
  }

  @Get('listings/:id')
  getOwned(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.listingsService.getOwned(userId, id);
  }

  @Patch('listings/:id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.updateListing(userId, id, dto);
  }

  @Patch('listings/:id/location')
  updateLocation(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.listingsService.updateLocation(userId, id, dto);
  }

  @Post('listings/:id/attributes')
  upsertAttributes(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpsertAttributesDto) {
    return this.listingsService.upsertAttributes(userId, id, dto);
  }

  @Post('listings/:id/faqs')
  upsertFaqs(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpsertFaqsDto) {
    return this.listingsService.upsertFaqs(userId, id, dto);
  }

  @Post('listings/:id/extra-services')
  upsertExtraServices(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpsertExtraServicesDto,
  ) {
    return this.listingsService.upsertExtraServices(userId, id, dto);
  }

  @Post('listings/:id/photos')
  @UseInterceptors(FileInterceptor('file'))
  addPhoto(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.listingsService.addPhoto(userId, id, file);
  }

  @Delete('listings/:id/photos/:photoId')
  removePhoto(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('photoId') photoId: string) {
    return this.listingsService.removePhoto(userId, id, photoId);
  }

  @Patch('listings/:id/photos/reorder')
  reorderPhotos(@CurrentUser('id') userId: string, @Param('id') id: string, @Body('photoIds') photoIds: string[]) {
    return this.listingsService.reorderPhotos(userId, id, photoIds);
  }

  @Get('listings/:id/readiness')
  getReadiness(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.listingsService.getReadiness(userId, id);
  }

  @Delete('listings/:id')
  deleteListing(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.listingsService.deleteListing(userId, id);
  }

  @Public()
  @Get('listings/public/:slug')
  getPublic(@Param('slug') slug: string) {
    return this.listingsService.getPublicBySlug(slug);
  }

  // -- Admin -----------------------------------------------------------

  @RequirePermissions('approve_listing')
  @Get('admin/listings/queue')
  adminQueue() {
    return this.listingsService.adminGetQueue();
  }

  @RequirePermissions('approve_listing')
  @Post('admin/listings/:id/approve')
  adminApprove(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.listingsService.adminApprove(adminId, id);
  }

  @RequirePermissions('approve_listing')
  @Post('admin/listings/:id/reject')
  adminReject(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: RejectListingDto) {
    return this.listingsService.adminReject(adminId, id, dto);
  }

  @RequirePermissions('approve_listing')
  @Post('admin/listings/versions/:versionId/approve')
  adminApproveVersion(@CurrentUser('id') adminId: string, @Param('versionId') versionId: string) {
    return this.listingsService.adminApproveVersion(adminId, versionId);
  }

  @RequirePermissions('approve_listing')
  @Post('admin/listings/versions/:versionId/reject')
  adminRejectVersion(
    @CurrentUser('id') adminId: string,
    @Param('versionId') versionId: string,
    @Body() dto: RejectVersionDto,
  ) {
    return this.listingsService.adminRejectVersion(adminId, versionId, dto);
  }
}
