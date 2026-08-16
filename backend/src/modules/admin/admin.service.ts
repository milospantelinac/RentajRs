import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { ProcessingStatus, Language } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PaymentSettingsService } from '../../common/payment/nestpay/payment-settings.service';
import { UpdatePaymentSettingsDto } from '../../common/payment/nestpay/dto/payment-settings.dto';
import {
  ReportListingDto,
  BlockUserDto,
  ResolveDisputeDto,
  UpdateSettingDto,
  UpdateEmailTemplateDto,
} from './dto/admin.dto';

const PRIORITY_REPORT_THRESHOLD = 3; // R144
const RESTRICTION_DAYS = 30; // Ch.6.7 — how long a RESTRICTION dispute outcome blocks new listings/bookings

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private i18n: I18nService,
    private events: EventEmitter2,
    private paymentSettings: PaymentSettingsService,
  ) {}

  // -- Users -----------------------------------------------------------

  async listUsers(search?: string, blocked?: boolean) {
    return this.prisma.user.findMany({
      where: {
        ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } : {}),
        ...(blocked !== undefined ? { blocked } : {}),
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, blocked: true, verified: true,
        completedBookingsCount: true, createdAt: true, lastLoginAt: true,
        warningsCount: true, restrictedUntil: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async blockUser(adminId: string, userId: string, dto: BlockUserDto) {
    await this.prisma.user.update({ where: { id: userId }, data: { blocked: true, blockedReason: dto.reason } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.logAction(adminId, 'block_user', 'User', userId, undefined, { reason: dto.reason });
    this.events.emit('user.blocked_by_admin', { userId, reason: dto.reason });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async unblockUser(adminId: string, userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { blocked: false, blockedReason: null } });
    await this.logAction(adminId, 'unblock_user', 'User', userId);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async deleteUserAsAdmin(adminId: string, userId: string) {
    await this.logAction(adminId, 'delete_user', 'User', userId);
    return this.users.executeDeletion(userId);
  }

  // -- Reports (listing reports, R144/R147) -------------------------------

  async reportListing(reporterId: string, listingId: string, dto: ReportListingDto) {
    const report = await this.prisma.report.create({
      data: { listingId, reportedByUserId: reporterId, reason: dto.reason, description: dto.description },
    });
    const count = await this.prisma.report.count({ where: { listingId, status: { not: 'DISMISSED' } } });
    if (count >= PRIORITY_REPORT_THRESHOLD) {
      this.events.emit('admin.listing_report_priority', { listingId, count });
    }
    this.events.emit('admin.listing_reported', { listingId });
    return report;
  }

  async listReports(status?: ProcessingStatus) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { listing: { select: { id: true, title: true, slug: true } }, reportedByUser: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async resolveReport(adminId: string, reportId: string, status: 'RESOLVED' | 'DISMISSED') {
    await this.prisma.report.update({ where: { id: reportId }, data: { status, handledByUserId: adminId } });
    await this.logAction(adminId, 'resolve_report', 'Report', reportId, undefined, { status });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Disputes ----------------------------------------------------------

  async listDisputes(status?: ProcessingStatus) {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, slug: true } },
        booking: { select: { id: true, status: true } },
        submittedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Ch.6.7/ADR-019 — admin decides about the ACCOUNT, never about money. */
  async resolveDispute(adminId: string, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'RESOLVED', outcome: dto.outcome, adminNote: dto.adminNote, handledByUserId: adminId },
    });

    if (dto.targetUserId && dto.outcome !== 'NO_ACTION') {
      if (dto.outcome === 'BLOCK') {
        await this.prisma.user.update({ where: { id: dto.targetUserId }, data: { blocked: true, blockedReason: `Dispute ${disputeId}: ${dto.adminNote ?? ''}` } });
        await this.prisma.session.updateMany({ where: { userId: dto.targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
      } else if (dto.outcome === 'WARNING') {
        await this.prisma.user.update({ where: { id: dto.targetUserId }, data: { warningsCount: { increment: 1 } } });
      } else if (dto.outcome === 'RESTRICTION') {
        // Blocks new listings and new booking requests (ListingsService.createDraft,
        // BookingsService.createRequest) until this passes — never a permanent state.
        await this.prisma.user.update({
          where: { id: dto.targetUserId },
          data: { restrictedUntil: new Date(Date.now() + RESTRICTION_DAYS * 86_400_000) },
        });
      }
      this.events.emit('admin.dispute_outcome_applied', { userId: dto.targetUserId, outcome: dto.outcome, disputeId });
    }

    if (dispute.type === 'DISPUTED_NO_SHOW' && dispute.bookingId) {
      // Disputing doesn't silently overturn the mark — the admin's WARNING/NO_ACTION call is the resolution (R94).
      this.events.emit('booking.no_show_dispute_resolved', { bookingId: dispute.bookingId, outcome: dto.outcome });
    }

    await this.logAction(adminId, 'resolve_dispute', 'Dispute', disputeId, undefined, dto as any);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Settings (R171) -----------------------------------------------

  async listSettings() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(adminId: string, key: string, dto: UpdateSettingDto) {
    const existing = await this.prisma.setting.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException();
    await this.prisma.setting.update({ where: { key }, data: { value: dto.value as any } });
    await this.logAction(adminId, 'update_setting', 'Setting', key, existing.value, dto.value);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Payment settings (Banca Intesa NestPay connector) ----------------

  async getPaymentSettings() {
    return this.paymentSettings.getMasked();
  }

  async updatePaymentSettings(adminId: string, dto: UpdatePaymentSettingsDto) {
    const before = await this.paymentSettings.getMasked();
    const updated = await this.paymentSettings.update(dto);
    // Masked before/after only — the audit log must never hold plaintext secrets.
    await this.logAction(adminId, 'update_payment_settings', 'PaymentSettings', 'default', before, updated);
    return updated;
  }

  // -- Email templates (R166) -----------------------------------------------

  async listEmailTemplates() {
    return this.prisma.emailTemplate.findMany({ orderBy: [{ key: 'asc' }, { language: 'asc' }] });
  }

  async updateEmailTemplate(adminId: string, key: string, language: Language, dto: UpdateEmailTemplateDto) {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { key_language: { key, language } } });
    if (!existing) throw new NotFoundException();
    await this.prisma.emailTemplate.update({
      where: { key_language: { key, language } },
      data: { subject: dto.subject, heading: dto.heading, bodyText: dto.bodyText, buttonLabel: dto.buttonLabel },
    });
    await this.logAction(adminId, 'update_email_template', 'EmailTemplate', `${key}:${language}`, existing, dto);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Reports for acquisition/ops (R46/R79) ------------------------------

  async getEmptySearchReport(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const searches = await this.prisma.emptySearch.findMany({
      where: { createdAt: { gte: since } },
      include: { category: { select: { slug: true } }, city: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const byQuery = new Map<string, number>();
    for (const s of searches) {
      const key = s.query?.trim().toLowerCase() || `[${s.category?.slug ?? 'any'}/${s.city?.name ?? 'any'}]`;
      byQuery.set(key, (byQuery.get(key) ?? 0) + 1);
    }
    return Array.from(byQuery.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getContactSharingReport(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const flagged = await this.prisma.message.findMany({
      where: { containsContact: true, sentAt: { gte: since } },
      select: { senderId: true },
    });
    const byUser = new Map<string, number>();
    for (const m of flagged) byUser.set(m.senderId, (byUser.get(m.senderId) ?? 0) + 1);

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(byUser.keys()) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    return users
      .map((u) => ({ ...u, flaggedMessageCount: byUser.get(u.id) ?? 0 }))
      .sort((a, b) => b.flaggedMessageCount - a.flaggedMessageCount);
  }

  // -- Audit log (R123) -----------------------------------------------

  async getAuditLog(entityType?: string, page = 1) {
    return this.prisma.adminLog.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      include: { user: { select: { firstName: true, lastName: true } } },
    });
  }

  async logAction(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.adminLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue === undefined ? undefined : (oldValue as any),
        newValue: newValue === undefined ? undefined : (newValue as any),
      },
    });
  }
}
