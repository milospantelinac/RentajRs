import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { formatDate, formatDateTime, formatRsd, localeFor } from '../format';

type LoadedSubscription = Prisma.SubscriptionGetPayload<{ include: { user: true; package: true } }>;
type Payment = Prisma.TransactionGetPayload<{ include: { invoices: true } }>;

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

  private loadPayment(subscriptionId: string) {
    return this.prisma.transaction.findFirst({
      where: { subscriptionId, status: 'SUCCESSFUL' },
      orderBy: { occurredAt: 'desc' },
      include: { invoices: true },
    });
  }

  /**
   * "Obnovi" in the expiry emails opens the renewal of that package, reached from
   * one of its listings (the renewal page lives under a listing); Moje pretplate
   * when no listing is left on it.
   */
  private async renewUrl(subscriptionId: string, listingId?: string) {
    const target =
      listingId ??
      (
        await this.prisma.listing.findFirst({
          where: { subscriptionId, status: { not: 'DELETED' } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      )?.id;
    return target
      ? `${this.frontendUrl}/oglasi/${target}/paket?obnova=${subscriptionId}`
      : `${this.frontendUrl}/kontrolna-tabla/pretplate`;
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

    const transaction = await this.loadPayment(subscriptionId);
    const locale = localeFor(sub.user.language);

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

    await this.sendInvoice(sub, transaction, userId);
  }

  /** A paid renewal: the period it covers, then the invoice. */
  @OnEvent('subscription.renewed')
  async onRenewed({ userId, subscriptionId }: { userId: string; subscriptionId: string }) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub) return;

    const transaction = await this.loadPayment(subscriptionId);
    const locale = localeFor(sub.user.language);

    await this.email.send({
      key: 'subscription_renewed',
      to: sub.user.email,
      language: sub.user.language,
      userId,
      context: {
        paket: sub.package.key,
        iznos: formatRsd(sub.priceAtPurchase),
        datum: formatDateTime(transaction?.occurredAt ?? sub.createdAt, locale),
        od: formatDate(sub.startsAt, locale),
        do: formatDate(sub.expiresAt, locale),
      },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
    });

    await this.sendInvoice(sub, transaction, userId);
  }

  private async sendInvoice(sub: LoadedSubscription, transaction: Payment | null, userId: string) {
    const invoice = transaction?.invoices[0];
    if (!invoice) return;
    await this.email.send({
      key: 'subscription_invoice',
      to: sub.user.email,
      language: sub.user.language,
      userId,
      context: {
        paket: sub.package.key,
        iznos: formatRsd(sub.priceAtPurchase),
        datum: formatDateTime(transaction.occurredAt ?? sub.createdAt, localeFor(sub.user.language)),
        broj: invoice.documentNumber,
      },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
    });
  }

  /**
   * A card payment at checkout that was declined or given up on: a first package,
   * a move to Pro and a renewal all end here. Nothing is left of the checkout by
   * then, so the event brings its package, amount and listing. "Pokušaj ponovo"
   * opens the same package choice as the button on the failure page.
   */
  @OnEvent('subscription.checkout_failed')
  async onCheckoutFailed({
    userId,
    packageId,
    amount,
    listingId,
    renewsSubscriptionId,
  }: {
    userId: string;
    packageId: string;
    amount: bigint;
    listingId: string;
    renewsSubscriptionId: string | null;
  }) {
    const [user, pkg, listing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.package.findUnique({ where: { id: packageId } }),
      this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, title: true } }),
    ]);
    if (!user || !pkg || !listing) return;

    const retryUrl = `${this.frontendUrl}/oglasi/${listing.id}/paket`;
    await this.email.send({
      key: 'subscription_checkout_failed',
      to: user.email,
      language: user.language,
      userId,
      context: { paket: pkg.key, iznos: formatRsd(amount), oglas: listing.title },
      buttonUrl: renewsSubscriptionId ? `${retryUrl}?obnova=${renewsSubscriptionId}` : retryUrl,
    });
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
      buttonUrl: await this.renewUrl(sub.id),
    });
  }

  @OnEvent('subscription.expired')
  async onExpired({ subscriptionId, listingIds }: { subscriptionId: string; listingIds?: string[] }) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub) return;
    await this.email.send({
      key: 'subscription_expired',
      to: sub.user.email,
      language: sub.user.language,
      userId: sub.userId,
      context: { paket: sub.package.key },
      buttonUrl: await this.renewUrl(sub.id, listingIds?.[0]),
    });
  }
}
