import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { escapeHtml } from '../../../common/utils/escape-html';
import { formatDate, formatDateTime, formatRsd, localeFor } from '../format';

/** A receipt's PDF is a page or two; anything bigger than this is not one. */
const MAX_PDF_BYTES = 2 * 1024 * 1024;

@Injectable()
export class SubscriptionEmailListener {
  private readonly logger = new Logger(SubscriptionEmailListener.name);
  private readonly frontendUrl: string;
  /** Receipt PDFs are only fetched from the fiscal service's own host. */
  private readonly pdfHost: string | null;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
    try {
      this.pdfHost = new URL(config.get<string>('fiscalization.fiscomm.baseUrl') ?? 'https://api.fiscomm.rs').hostname;
    } catch {
      this.pdfHost = null;
    }
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
   * "Package activated" goes out at once, with the actual amount and date rather
   * than just the package name: Banca Intesa's pilot checklist item 2.7 wants
   * the payment confirmation email to show real details. The fiscal receipt
   * follows in its own email as soon as it is issued (`invoice.issued` below),
   * which is usually a second or two later, so a slow fiscal service never holds
   * the confirmation back.
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
  }

  /** A paid renewal: the period it covers. Its receipt follows like any other. */
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
  }

  /**
   * The fiscal receipt exists (FiscalizationService): the customer gets it by
   * email with its PDF attached, its number and the link to check it with the
   * Tax Administration. `sentAt` is set once the mail system has taken the
   * message, which is what keeps a receipt from going out twice.
   */
  @OnEvent('invoice.issued')
  async onInvoiceIssued({ invoiceId }: { invoiceId: string }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { user: true, transaction: { include: { subscription: { include: { package: true } } } } },
    });
    if (!invoice || invoice.documentType !== 'FISCAL_RECEIPT' || invoice.status !== 'ISSUED' || invoice.sentAt) return;

    const { user } = invoice;
    const isEn = user.language === 'EN';
    const pdf = invoice.pdfUrl ? await this.downloadPdf(invoice.pdfUrl) : null;

    const sent = await this.email.send({
      key: 'subscription_invoice',
      to: user.email,
      language: user.language,
      userId: user.id,
      context: {
        paket: invoice.transaction.subscription?.package.key ?? '',
        iznos: formatRsd(invoice.amount),
        datum: formatDateTime(invoice.issuedAt ?? invoice.createdAt, localeFor(user.language)),
        broj: invoice.documentNumber ?? '',
      },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
      extraMjml: receiptLinksMjml({ verificationUrl: invoice.verificationUrl, pdfUrl: invoice.pdfUrl, attached: !!pdf }, isEn),
      attachments: pdf ? [{ filename: `racun-${invoice.documentNumber}.pdf`, content: pdf, contentType: 'application/pdf' }] : undefined,
    });
    if (sent) await this.prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } });
  }

  /**
   * The receipt's PDF for the email, or null: the email still goes out with a link
   * instead. Only the fiscal service's own host is fetched, over https, and only
   * something that really is a small PDF is attached.
   */
  private async downloadPdf(url: string): Promise<Buffer | null> {
    try {
      const target = new URL(url);
      if (target.protocol !== 'https:' || target.hostname !== this.pdfHost) {
        this.logger.warn(`Receipt PDF not fetched, it is not on the fiscal service's host: ${target.hostname}`);
        return null;
      }
      const response = await fetch(target, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('pdf')) return null;
      const body = Buffer.from(await response.arrayBuffer());
      return body.length > 0 && body.length <= MAX_PDF_BYTES && body.subarray(0, 5).toString('latin1') === '%PDF-' ? body : null;
    } catch (err) {
      this.logger.warn(`Receipt PDF not fetched, the email goes with a link: ${(err as Error).message}`);
      return null;
    }
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

/**
 * The receipt's own links as rows under the email's text: where to read the PDF
 * and where to check the receipt with the Tax Administration. Nothing for a
 * receipt that has neither (the placeholder provider's).
 */
export function receiptLinksMjml(links: { verificationUrl: string | null; pdfUrl: string | null; attached: boolean }, isEn: boolean): string | undefined {
  // Only https links go into an email, whatever the provider's answer held.
  const secure = (url: string | null) => (url && /^https:\/\//i.test(url) ? escapeHtml(url) : null);
  const pdfUrl = secure(links.pdfUrl);
  const verificationUrl = secure(links.verificationUrl);
  const rows: string[] = [];
  if (links.attached) {
    rows.push(`<mj-text padding-bottom="6px">${isEn ? 'The receipt is attached to this email as a PDF.' : 'Račun je u prilogu ovog mejla, u PDF-u.'}</mj-text>`);
  } else if (pdfUrl) {
    rows.push(`<mj-text padding-bottom="6px"><a href="${pdfUrl}">${isEn ? 'Download the receipt (PDF)' : 'Preuzmite račun (PDF)'}</a></mj-text>`);
  }
  if (verificationUrl) {
    rows.push(
      `<mj-text padding-bottom="6px">${isEn ? 'Check the receipt with the Tax Administration:' : 'Proverite račun kod Poreske uprave:'} <a href="${verificationUrl}">${isEn ? 'open the check' : 'otvorite proveru'}</a></mj-text>`,
    );
  }
  return rows.length ? rows.join('') : undefined;
}
