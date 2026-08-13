import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import {
  PurchaseSubscriptionDto,
  PurchaseFeaturedDto,
  CancelSubscriptionDto,
  AdjustPriceDto,
} from './dto/subscriptions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SubscriptionStatus } from '@prisma/client';

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('packages')
  listPackages() {
    return this.subscriptionsService.listPackages();
  }

  @Get('subscriptions/mine')
  mine(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getMySubscriptions(userId);
  }

  @Post('subscriptions/purchase')
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseSubscriptionDto) {
    return this.subscriptionsService.purchaseForListing(userId, dto);
  }

  @Post('subscriptions/:id/cancel')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: CancelSubscriptionDto) {
    return this.subscriptionsService.cancelSubscription(userId, id, dto);
  }

  @Post('featured/purchase')
  purchaseFeatured(@CurrentUser('id') userId: string, @Body() dto: PurchaseFeaturedDto) {
    return this.subscriptionsService.purchaseFeatured(userId, dto);
  }

  @Public()
  @Get('featured')
  getRotatedFeatured(@Query('categoryId') categoryId: string, @Query('limit') limit?: string) {
    return this.subscriptionsService.getRotatedFeatured(categoryId, limit ? parseInt(limit, 10) : undefined);
  }

  // -- Admin -------------------------------------------------------------

  @RequirePermissions('manage_subscriptions')
  @Get('admin/subscriptions')
  adminList(@Query('status') status?: SubscriptionStatus) {
    return this.subscriptionsService.adminListSubscriptions(status);
  }

  @RequirePermissions('manual_activate_subscription')
  @Post('admin/subscriptions/:id/activate')
  adminActivate(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.subscriptionsService.adminActivateSubscription(adminId, id);
  }

  @RequirePermissions('manage_subscriptions')
  @Post('admin/packages/:id/price')
  adminUpdatePrice(@Param('id') id: string, @Body() dto: AdjustPriceDto) {
    return this.subscriptionsService.adminUpdatePackagePrice(id, dto);
  }
}
