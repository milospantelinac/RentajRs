import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { DisputeOutcome } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { formatDateTime, localeFor } from '../format';

@Injectable()
export class AccountEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  @OnEvent('auth.registered')
  async onRegistered({ userId, verificationToken }: { userId: string; verificationToken: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'welcome_registration',
      to: user.email,
      language: user.language,
      userId,
      context: { ime: user.firstName },
      buttonUrl: `${this.frontendUrl}/potvrda-adrese?token=${verificationToken}`,
    });
  }

  @OnEvent('auth.verification_resent')
  async onVerificationResent({ userId, verificationToken }: { userId: string; verificationToken: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'verify_email_resend',
      to: user.email,
      language: user.language,
      userId,
      buttonUrl: `${this.frontendUrl}/potvrda-adrese?token=${verificationToken}`,
    });
  }

  @OnEvent('auth.password_reset_requested')
  async onPasswordResetRequested({ userId, resetToken }: { userId: string; resetToken: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'password_reset_request',
      to: user.email,
      language: user.language,
      userId,
      buttonUrl: `${this.frontendUrl}/resetovanje-lozinke?token=${resetToken}`,
    });
  }

  @OnEvent('auth.password_changed')
  async onPasswordChanged({ userId }: { userId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'password_changed',
      to: user.email,
      language: user.language,
      userId,
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
    });
  }

  @OnEvent('auth.two_factor_reset_by_password_reset')
  async onTwoFactorResetByPasswordReset({ userId }: { userId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'two_factor_reset_by_password_reset',
      to: user.email,
      language: user.language,
      userId,
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
    });
  }

  @OnEvent('auth.new_device_login')
  async onNewDeviceLogin({ userId, device }: { userId: string; device?: string; ip?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'new_device_login',
      to: user.email,
      language: user.language,
      userId,
      context: { device: device || 'unknown device' },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
    });
  }

  @OnEvent('user.blocked_by_admin')
  async onBlocked({ userId, reason }: { userId: string; reason: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'account_blocked',
      to: user.email,
      language: user.language,
      userId,
      context: { razlog: reason },
      buttonUrl: `${this.frontendUrl}/kontakt`,
    });
  }

  // T90: a dispute outcome against an account reaches its holder. The admin's
  // note stays internal; a block names the review as its reason instead.
  @OnEvent('admin.dispute_outcome_applied')
  async onDisputeOutcomeApplied({ userId, outcome }: { userId: string; outcome: DisputeOutcome }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const base = { to: user.email, language: user.language, userId, buttonUrl: `${this.frontendUrl}/kontakt` };
    if (outcome === 'WARNING') {
      await this.email.send({ ...base, key: 'account_warning' });
    } else if (outcome === 'RESTRICTION') {
      await this.email.send({
        ...base,
        key: 'account_restricted',
        context: { datum: formatDateTime(user.restrictedUntil, localeFor(user.language)) },
      });
    } else if (outcome === 'BLOCK') {
      const razlog = user.language === 'EN' ? 'decision after reviewing a report' : 'odluka posle pregleda prijave';
      await this.email.send({ ...base, key: 'account_blocked', context: { razlog } });
    }
  }
}
