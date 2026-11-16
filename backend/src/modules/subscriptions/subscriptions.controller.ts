import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Redirect } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { PurchaseSubscriptionDto, AdjustPriceDto, InitCheckoutDto } from './dto/subscriptions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { InvoiceStatus, SubscriptionStatus } from '@prisma/client';

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

  // What renewing this package would carry over and when the new period starts.
  @Get('subscriptions/:id/renewal')
  getRenewal(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.getRenewal(userId, id);
  }

  @Post('subscriptions/purchase')
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseSubscriptionDto) {
    return this.subscriptionsService.purchaseForListing(userId, dto);
  }

  @Delete('subscriptions/:id')
  deleteAwaitingPayment(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.subscriptionsService.deleteAwaitingPayment(userId, id);
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

  // Featured listings have their own controller (modules/featured).

  // -- Admin -------------------------------------------------------------

  @RequirePermissions('manage_subscriptions')
  @Get('admin/subscriptions')
  adminList(@Query('status') status?: SubscriptionStatus) {
    return this.subscriptionsService.adminListSubscriptions(status);
  }

  @RequirePermissions('manual_activate_subscription')
  @Post('admin/subscriptions/:id/activate')
  @HttpCode(200)
  adminActivate(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.subscriptionsService.adminActivateSubscription(adminId, id);
  }

  @RequirePermissions('manage_subscriptions')
  @Post('admin/packages/:id/price')
  adminUpdatePrice(@Param('id') id: string, @Body() dto: AdjustPriceDto) {
    return this.subscriptionsService.adminUpdatePackagePrice(id, dto);
  }

  // -- Fiscal receipts (Administracija > Racuni) -----------------------------

  @RequirePermissions('manage_subscriptions')
  @Get('admin/invoices')
  adminInvoices(@Query('status') status?: string) {
    if (status && !Object.values(InvoiceStatus).includes(status as InvoiceStatus)) throw new BadRequestException('Unknown status');
    return this.subscriptionsService.adminListInvoices(status as InvoiceStatus | undefined);
  }

  @RequirePermissions('manage_subscriptions')
  @Post('admin/invoices/:id/retry')
  @HttpCode(200)
  adminRetryInvoice(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.adminRetryInvoice(adminId, id);
  }

  /** A live check of the connection: the account behind the key, and whether the tax label exists on it. */
  @RequirePermissions('manage_subscriptions')
  @Get('admin/fiscalization/status')
  adminFiscalizationStatus() {
    return this.subscriptionsService.adminFiscalizationStatus();
  }
}
