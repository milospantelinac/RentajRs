import { Body, Controller, Get, Param, Post, Query, Redirect } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import {
  PurchaseSubscriptionDto,
  PurchaseFeaturedDto,
  CancelSubscriptionDto,
  AdjustPriceDto,
  InitCheckoutDto,
  AssignFreeFeaturedDto,
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

  // Banca Intesa pilot checklist item 2.7 — the confirmation shown on
  // /oglasi/:id/poslato right after checkout reads this to show what was
  // actually charged, rather than just a generic "submitted" message.
  @Get('subscriptions/:id/receipt')
  getReceipt(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.subscriptionsService.getSubscriptionReceipt(userId, id);
  }

  @Post('subscriptions/purchase')
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseSubscriptionDto) {
    return this.subscriptionsService.purchaseForListing(userId, dto);
  }

  // -- Checkout (Banca Intesa NestPay) ------------------------------------

  @Post('subscriptions/checkout/init')
  initCheckout(@CurrentUser('id') userId: string, @Body() dto: InitCheckoutDto) {
    return this.subscriptionsService.initCheckout(userId, dto);
  }

  // These two are NestPay's okUrl/failUrl — the customer's browser is POSTed
  // here directly by NestPay's hosted payment page, with no session/JWT of
  // ours attached, so they must stay public. Integrity comes entirely from
  // the HASH field (see NestPayCheckoutService.verifyCallback), not from auth.
  @Public()
  @Redirect()
  @Post('subscriptions/nestpay/callback/success')
  async nestpaySuccess(@Body() body: Record<string, string>) {
    return { url: await this.subscriptionsService.handleNestPaySuccess(body), statusCode: 303 };
  }

  @Public()
  @Redirect()
  @Post('subscriptions/nestpay/callback/fail')
  async nestpayFail(@Body() body: Record<string, string>) {
    return { url: await this.subscriptionsService.handleNestPayFail(body), statusCode: 303 };
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

  @Public()
  @Get('featured/prices')
  getFeaturedPrices() {
    return this.subscriptionsService.getFeaturedPrices();
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

  // Featured-listing prices live in Setting like everything else in
  // Ch.23's "admin changes data" list — edited through the generic
  // /admin/podesavanja panel (PATCH /admin/settings/:key), not a
  // dedicated endpoint here (see key "featured_listing_prices").

  @RequirePermissions('manage_featured')
  @Post('admin/featured/:listingId/assign-free')
  adminAssignFreeFeatured(
    @CurrentUser('id') adminId: string,
    @Param('listingId') listingId: string,
    @Body() dto: AssignFreeFeaturedDto,
  ) {
    return this.subscriptionsService.adminAssignFreeFeatured(adminId, listingId, dto.durationDays);
  }

  @RequirePermissions('manage_featured')
  @Get('admin/featured/waitlist')
  adminGetFeaturedWaitlist() {
    return this.subscriptionsService.adminGetFeaturedWaitlist();
  }
}
