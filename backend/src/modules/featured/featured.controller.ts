import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeaturedService } from './featured.service';
import {
  AdminApproveFeaturedDto,
  AdminChangeFeaturedEndDto,
  AdminFeaturedPeriodsQueryDto,
  AdminFeaturedRequestsQueryDto,
  AdminFeaturedRulesDto,
  AdminGrantFeaturedDto,
  AdminGrantLeaderDto,
  AdminLeaderRuleDto,
  AdminRankingWeightsDto,
  AdminRejectFeaturedDto,
  AdminSetLeaderDto,
} from './dto/featured.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('featured')
@Controller()
export class FeaturedController {
  constructor(private featured: FeaturedService) {}

  // -- Public ----------------------------------------------------------------

  /** The home page's "Izdvajamo iz ponude": every featured listing, in the order to show them. */
  @Public()
  @Get('featured/home')
  getHome() {
    return this.featured.getHome();
  }

  /** A featured card was opened (sent with navigator.sendBeacon, so no body and no answer). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(204)
  @Post('featured/:listingId/click')
  async recordClick(@Param('listingId', ParseUUIDPipe) listingId: string) {
    await this.featured.recordClick(listingId);
  }

  @Public()
  @Get('featured/prices')
  getPrices() {
    return this.featured.getPrices();
  }

  // -- Owners ----------------------------------------------------------------

  @Get('featured/mine')
  getMine(@CurrentUser('id') userId: string) {
    return this.featured.getMine(userId);
  }

  @Post('listings/:id/featured-request')
  request(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) listingId: string) {
    return this.featured.requestByOwner(userId, listingId);
  }

  @Delete('listings/:id/featured-request')
  cancelRequest(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) listingId: string) {
    return this.featured.cancelByOwner(userId, listingId);
  }

  // -- Admin: periods ----------------------------------------------------------

  @RequirePermissions('manage_featured')
  @Get('admin/featured/periods')
  adminPeriods(@Query() query: AdminFeaturedPeriodsQueryDto) {
    return this.featured.adminListPeriods(query.state ?? 'live');
  }

  @RequirePermissions('manage_featured')
  @Get('admin/featured/capacity')
  adminCapacity() {
    return this.featured.adminCapacity();
  }

  @RequirePermissions('manage_featured')
  @Post('admin/featured/grant')
  adminGrant(@CurrentUser('id') adminId: string, @Body() dto: AdminGrantFeaturedDto) {
    return this.featured.adminGrant(adminId, dto);
  }

  @RequirePermissions('manage_featured')
  @Patch('admin/featured/periods/:id')
  adminChangeEnd(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminChangeFeaturedEndDto,
  ) {
    return this.featured.adminChangeEnd(adminId, id, new Date(dto.expiresAt));
  }

  @RequirePermissions('manage_featured')
  @HttpCode(200)
  @Post('admin/featured/periods/:id/end')
  adminEnd(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.featured.adminEnd(adminId, id);
  }

  @RequirePermissions('manage_featured')
  @Get('admin/featured/listings')
  adminSearchListings(@Query('q') q = '') {
    return this.featured.adminSearchListings(q);
  }

  // -- Admin: requests ---------------------------------------------------------

  @RequirePermissions('manage_featured')
  @Get('admin/featured/requests')
  adminRequests(@Query() query: AdminFeaturedRequestsQueryDto) {
    return this.featured.adminListRequests(query.status);
  }

  @RequirePermissions('manage_featured')
  @HttpCode(200)
  @Post('admin/featured/requests/:id/approve')
  adminApprove(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminApproveFeaturedDto,
  ) {
    return this.featured.adminApprove(adminId, id, dto);
  }

  @RequirePermissions('manage_featured')
  @HttpCode(200)
  @Post('admin/featured/requests/:id/reject')
  adminReject(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminRejectFeaturedDto,
  ) {
    return this.featured.adminReject(adminId, id, dto.reason);
  }

  // -- Admin: leaders ------------------------------------------------------------

  @RequirePermissions('manage_featured')
  @Get('admin/featured/leaders')
  adminLeaders() {
    return this.featured.adminListLeaders();
  }

  @RequirePermissions('manage_featured')
  @Put('admin/featured/leaders/rule')
  adminLeaderRule(@CurrentUser('id') adminId: string, @Body() dto: AdminLeaderRuleDto) {
    return this.featured.adminSetLeaderRule(adminId, dto);
  }

  @RequirePermissions('manage_featured')
  @HttpCode(200)
  @Post('admin/featured/leaders/grant-all')
  adminGrantAllLeaders(@CurrentUser('id') adminId: string) {
    return this.featured.adminGrantAllLeaders(adminId);
  }

  @RequirePermissions('manage_featured')
  @Get('admin/featured/users')
  adminSearchUsers(@Query('q') q = '') {
    return this.featured.adminSearchUsers(q);
  }

  @RequirePermissions('manage_featured')
  @Put('admin/featured/leaders/:userId')
  adminSetLeader(
    @CurrentUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminSetLeaderDto,
  ) {
    return this.featured.adminSetLeader(adminId, userId, dto.override ?? null);
  }

  @RequirePermissions('manage_featured')
  @HttpCode(200)
  @Post('admin/featured/leaders/:userId/grant')
  adminGrantLeader(
    @CurrentUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminGrantLeaderDto,
  ) {
    return this.featured.adminGrantLeader(adminId, userId, dto.listingId);
  }

  // -- Admin: rules, preview, history ---------------------------------------------

  @RequirePermissions('manage_featured')
  @Get('admin/featured/settings')
  adminSettings() {
    return this.featured.adminGetSettings();
  }

  @RequirePermissions('manage_featured')
  @Put('admin/featured/settings')
  adminUpdateRules(@CurrentUser('id') adminId: string, @Body() dto: AdminFeaturedRulesDto) {
    return this.featured.adminUpdateRules(adminId, dto);
  }

  /** The weights of "Preporučeno" are a platform setting, not only a featured one. */
  @RequirePermissions('manage_settings')
  @Put('admin/featured/ranking')
  adminUpdateRanking(@CurrentUser('id') adminId: string, @Body() dto: AdminRankingWeightsDto) {
    return this.featured.adminUpdateRanking(adminId, dto);
  }

  @RequirePermissions('manage_featured')
  @Get('admin/featured/preview')
  adminPreview(@Query('categorySlug') categorySlug?: string, @Query('cityId') cityId?: string) {
    return this.featured.adminPreview(categorySlug || undefined, cityId || undefined);
  }

  @RequirePermissions('manage_featured')
  @Get('admin/featured/history')
  adminHistory() {
    return this.featured.adminHistory();
  }
}
