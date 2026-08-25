import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { formatDate, formatDateTime, formatRsd, localeFor } from '../format';

@Injectable()
export class SubscriptionEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  private async loadSub(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, package: true },
    });
    return sub;
  }

  /**
   * Fires both "package activated" and, if an invoice exists, "your invoice"
   * (Ch.22.4 groups these under the same trigger). Both carry the actual
   * amount/date/document number rather than just the package name — Banca
   * Intesa's pilot checklist item 2.7 wants the payment confirmation email
   * to show real details, not just point at an (unattached) receipt.
   */
  @OnEvent('subscription.purchased')
  async onPurchased({ userId, subscriptionId }: { userId: string; subscriptionId: string }) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub) return;

    const transaction = await this.prisma.transaction.findFirst({
      where: { subscriptionId, status: 'SUCCESSFUL' },
      orderBy: { occurredAt: 'desc' },
      include: { invoices: true },
    });
    const locale = localeFor(sub.user.language);
    const invoice = transaction?.invoices[0];

    await this.email.send({
      key: 'subscription_activated',
      to: sub.user.email,
      language: sub.user.language,
      userId,
      context: {
        paket: sub.package.key,
        iznos: formatRsd(sub.priceAtPurchase),
        datum: formatDateTime(transaction?.occurredAt ?? sub.createdAt, locale),
      },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
    });

    if (invoice) {
      await this.email.send({
        key: 'subscription_invoice',
        to: sub.user.email,
        language: sub.user.language,
        userId,
        context: {
          paket: sub.package.key,
          iznos: formatRsd(sub.priceAtPurchase),
          datum: formatDateTime(transaction?.occurredAt ?? sub.createdAt, locale),
          broj: invoice.documentNumber,
        },
        buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
      });
    }
  }

  @OnEvent('subscription.pro_forma_issued')
  async onProFormaIssued({ userId, subscriptionId }: { userId: string; subscriptionId: string }) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub) return;
    await this.email.send({
      key: 'subscription_pro_forma',
      to: sub.user.email,
      language: sub.user.language,
      userId,
      context: { paket: sub.package.key },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
    });
  }

  @OnEvent('subscription.expiring_soon')
  async onExpiringSoon({ subscriptionId, daysLeft }: { subscriptionId: string; daysLeft: number }) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub) return;
    await this.email.send({
      key: 'subscription_expiring_soon',
      to: sub.user.email,
      language: sub.user.language,
      userId: sub.userId,
      context: { paket: sub.package.key, broj: daysLeft, datum: formatDate(sub.expiresAt, localeFor(sub.user.language)) },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
    });
  }

  @OnEvent('subscription.expired')
  async onExpired({ subscriptionId }: { subscriptionId: string }) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub) return;
    await this.email.send({
      key: 'subscription_expired',
      to: sub.user.email,
      language: sub.user.language,
      userId: sub.userId,
      context: { paket: sub.package.key },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
    });
  }
}
