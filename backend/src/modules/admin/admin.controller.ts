import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProcessingStatus, Language } from '@prisma/client';
import { AdminService } from './admin.service';
import {
  ReportListingDto,
  BlockUserDto,
  ResolveDisputeDto,
  UpdateSettingDto,
  UpdateEmailTemplateDto,
  UpdateStaticPageDto,
  CreateFaqDto,
  UpdateFaqDto,
} from './dto/admin.dto';
import { UpdatePaymentSettingsDto } from '../../common/payment/nestpay/dto/payment-settings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('admin')
@Controller()
export class AdminController {
  constructor(private adminService: AdminService) {}

  // -- Any authenticated user --------------------------------------------

  @Post('listings/:id/report')
  reportListing(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: ReportListingDto) {
    return this.adminService.reportListing(userId, id, dto);
  }

  // -- Admin: users --------------------------------------------------

  @RequirePermissions('manage_users')
  @Get('admin/users')
  listUsers(@Query('search') search?: string, @Query('blocked') blocked?: string) {
    return this.adminService.listUsers(search, blocked === undefined ? undefined : blocked === 'true');
  }

  @RequirePermissions('manage_users')
  @Post('admin/users/:id/block')
  blockUser(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: BlockUserDto) {
    return this.adminService.blockUser(adminId, id, dto);
  }

  @RequirePermissions('manage_users')
  @Post('admin/users/:id/unblock')
  unblockUser(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.adminService.unblockUser(adminId, id);
  }

  // -- Admin: reports ------------------------------------------------

  @RequirePermissions('resolve_disputes')
  @Get('admin/reports')
  listReports(@Query('status') status?: ProcessingStatus) {
    return this.adminService.listReports(status);
  }

  @RequirePermissions('resolve_disputes')
  @Patch('admin/reports/:id')
  resolveReport(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body('status') status: 'RESOLVED' | 'DISMISSED',
  ) {
    return this.adminService.resolveReport(adminId, id, status);
  }

  // -- Admin: disputes -------------------------------------------------

  @RequirePermissions('resolve_disputes')
  @Get('admin/disputes')
  listDisputes(@Query('status') status?: ProcessingStatus) {
    return this.adminService.listDisputes(status);
  }

  @RequirePermissions('resolve_disputes')
  @Post('admin/disputes/:id/resolve')
  resolveDispute(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.adminService.resolveDispute(adminId, id, dto);
  }

  // -- Admin: settings -------------------------------------------------

  @RequirePermissions('manage_settings')
  @Get('admin/settings')
  listSettings() {
    return this.adminService.listSettings();
  }

  @RequirePermissions('manage_settings')
  @Patch('admin/settings/:key')
  updateSetting(@CurrentUser('id') adminId: string, @Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.adminService.updateSetting(adminId, key, dto);
  }

  // -- Admin: payment settings (Banca Intesa NestPay connector) --------

  @RequirePermissions('manage_settings')
  @Get('admin/payment-settings')
  getPaymentSettings() {
    return this.adminService.getPaymentSettings();
  }

  @RequirePermissions('manage_settings')
  @Patch('admin/payment-settings')
  updatePaymentSettings(@CurrentUser('id') adminId: string, @Body() dto: UpdatePaymentSettingsDto) {
    return this.adminService.updatePaymentSettings(adminId, dto);
  }

  // -- Admin: email templates (R166) -----------------------------------

  @RequirePermissions('manage_settings')
  @Get('admin/email-templates')
  listEmailTemplates() {
    return this.adminService.listEmailTemplates();
  }

  @RequirePermissions('manage_settings')
  @Patch('admin/email-templates/:key/:language')
  updateEmailTemplate(
    @CurrentUser('id') adminId: string,
    @Param('key') key: string,
    @Param('language') language: Language,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.adminService.updateEmailTemplate(adminId, key, language, dto);
  }

  // -- Admin: static pages (legal/about, Rich Text Editor) --------------

  @RequirePermissions('manage_settings')
  @Get('admin/static-pages')
  listStaticPages() {
    return this.adminService.listStaticPages();
  }

  @RequirePermissions('manage_settings')
  @Patch('admin/static-pages/:slug/:language')
  updateStaticPage(
    @CurrentUser('id') adminId: string,
    @Param('slug') slug: string,
    @Param('language') language: Language,
    @Body() dto: UpdateStaticPageDto,
  ) {
    return this.adminService.updateStaticPage(adminId, slug, language, dto);
  }

  // -- Admin: FAQ ---------------------------------------------------------

  @RequirePermissions('manage_settings')
  @Get('admin/faqs')
  listFaqsAdmin() {
    return this.adminService.listFaqsAdmin();
  }

  @RequirePermissions('manage_settings')
  @Post('admin/faqs')
  createFaq(@CurrentUser('id') adminId: string, @Body() dto: CreateFaqDto) {
    return this.adminService.createFaq(adminId, dto);
  }

  @RequirePermissions('manage_settings')
  @Patch('admin/faqs/:id')
  updateFaq(@CurrentUser('id') adminId: string, @Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.adminService.updateFaq(adminId, id, dto);
  }

  @RequirePermissions('manage_settings')
  @Delete('admin/faqs/:id')
  deleteFaq(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.adminService.deleteFaq(adminId, id);
  }

  // -- Admin: reports for ops -----------------------------------------

  @RequirePermissions('view_admin_logs')
  @Get('admin/reports/empty-searches')
  emptySearchReport(@Query('days') days?: string) {
    return this.adminService.getEmptySearchReport(days ? parseInt(days, 10) : undefined);
  }

  @RequirePermissions('view_admin_logs')
  @Get('admin/reports/contact-sharing')
  contactSharingReport(@Query('days') days?: string) {
    return this.adminService.getContactSharingReport(days ? parseInt(days, 10) : undefined);
  }

  @RequirePermissions('view_admin_logs')
  @Get('admin/logs')
  auditLog(@Query('entityType') entityType?: string, @Query('page') page?: string) {
    return this.adminService.getAuditLog(entityType, page ? parseInt(page, 10) : undefined);
  }
}
