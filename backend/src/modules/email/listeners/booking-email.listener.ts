import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import * as QRCode from 'qrcode';
import { Booking, Listing, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { formatRsd, formatDateTime, localeFor } from '../format';

type FullBooking = Booking & { listing: Listing; guest: User; owner: User };

@Injectable()
export class BookingEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  private async load(bookingId: string): Promise<FullBooking | null> {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true, guest: true, owner: true },
    }) as Promise<FullBooking | null>;
  }

  private bookingUrl(bookingId: string) {
    return `${this.frontendUrl}/rezervacije/${bookingId}`;
  }

  @OnEvent('booking.requested')
  async onRequested({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await Promise.all([
      this.email.send({
        key: 'booking_requested_guest',
        to: b.guest.email,
        language: b.guest.language,
        userId: b.guest.id,
        context: { oglas: b.listing.title },
        buttonUrl: this.bookingUrl(b.id),
      }),
      this.email.send({
        key: 'booking_requested_owner',
        to: b.owner.email,
        language: b.owner.language,
        userId: b.owner.id,
        context: { oglas: b.listing.title },
        buttonUrl: this.bookingUrl(b.id),
      }),
    ]);
  }

  @OnEvent('booking.request_unopened_reminder')
  async onUnopenedReminder({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.email.send({
      key: 'booking_request_unopened_reminder',
      to: b.owner.email,
      language: b.owner.language,
      userId: b.owner.id,
      context: { oglas: b.listing.title },
      buttonUrl: this.bookingUrl(b.id),
    });
  }

  @OnEvent('booking.rejected')
  async onRejected({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.email.send({
      key: 'booking_rejected',
      to: b.guest.email,
      language: b.guest.language,
      userId: b.guest.id,
      context: { oglas: b.listing.title },
      // T79 — was hardcoded to /pretraga (every other booking event links to
      // the booking itself); the in-app notification bell uses this same
      // buttonUrl as its linkUrl, so clicking "your request was rejected"
      // sent the guest to the search page instead of the actual booking.
      buttonUrl: this.bookingUrl(b.id),
    });
  }

  /** R63/R181 — the most important email in the system: amount, account, reference, IPS QR, deadline, cancellation terms. */
  @OnEvent('booking.awaiting_payment')
  async onAwaitingPayment({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    const locale = localeFor(b.guest.language);
    const isEn = b.guest.language === 'EN';
    const qrDataUrl = b.ipsQrData ? await QRCode.toDataURL(b.ipsQrData, { width: 240, margin: 1 }) : null;

    const extraMjml = `
      <mj-text font-weight="600" padding-bottom="8px">${isEn ? 'Payment details' : 'Detalji uplate'}</mj-text>
      <mj-text padding-bottom="2px">${isEn ? 'Amount' : 'Iznos'}: ${formatRsd(b.amountDue)}</mj-text>
      <mj-text padding-bottom="2px">${isEn ? 'Account' : 'Račun'}: ${b.owner.bankAccount ?? ''}</mj-text>
      <mj-text padding-bottom="2px">${isEn ? 'Reference number' : 'Poziv na broj'}: ${b.id.replace(/-/g, '').slice(0, 20)}</mj-text>
      <mj-text padding-bottom="12px">${isEn ? 'Deadline' : 'Rok'}: ${formatDateTime(b.paymentDeadline, locale)}</mj-text>
      ${qrDataUrl ? `<mj-image src="${qrDataUrl}" width="200px" padding-bottom="12px" />` : ''}
      ${
        b.cancellationTermsSnapshot
          ? `<mj-text font-size="13px" color="#6b7280" padding-bottom="8px">${isEn ? 'Cancellation terms' : 'Uslovi otkazivanja'}: ${b.cancellationTermsSnapshot}</mj-text>`
          : ''
      }
      <mj-text font-size="12px" color="#6b7280">${
        isEn
          ? 'Payment goes directly to the owner. Rentaj never mediates payment.'
          : 'Uplata ide direktno vlasniku. Rentaj ne posreduje u plaćanju.'
      }</mj-text>
    `;

    await this.email.send({
      key: 'booking_payment_instructions',
      to: b.guest.email,
      language: b.guest.language,
      userId: b.guest.id,
      context: { oglas: b.listing.title, iznos: formatRsd(b.amountDue), rok: formatDateTime(b.paymentDeadline, locale) },
      buttonUrl: this.bookingUrl(b.id),
      extraMjml,
    });
  }

  @OnEvent('booking.payment_reminder_half')
  async onPaymentReminderHalf({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.email.send({
      key: 'booking_payment_reminder_half',
      to: b.guest.email,
      language: b.guest.language,
      userId: b.guest.id,
      context: { oglas: b.listing.title, iznos: formatRsd(b.amountDue), rok: formatDateTime(b.paymentDeadline, localeFor(b.guest.language)) },
      buttonUrl: this.bookingUrl(b.id),
    });
  }

  @OnEvent('booking.payment_reminder_final')
  async onPaymentReminderFinal({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.email.send({
      key: 'booking_payment_reminder_final',
      to: b.guest.email,
      language: b.guest.language,
      userId: b.guest.id,
      context: { oglas: b.listing.title, iznos: formatRsd(b.amountDue), rok: formatDateTime(b.paymentDeadline, localeFor(b.guest.language)) },
      buttonUrl: this.bookingUrl(b.id),
    });
  }

  @OnEvent('booking.expired')
  async onExpired({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await Promise.all(
      [b.guest, b.owner].map((recipient) =>
        this.email.send({
          key: 'booking_expired',
          to: recipient.email,
          language: recipient.language,
          userId: recipient.id,
          context: { oglas: b.listing.title },
          buttonUrl: `${this.frontendUrl}/oglasi/${b.listing.slug}`,
        }),
      ),
    );
  }

  @OnEvent('booking.confirmed')
  async onConfirmed({ bookingId, viaCash }: { bookingId: string; viaCash: boolean }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.email.send({
      key: viaCash ? 'booking_confirmed_cash' : 'booking_payment_confirmed',
      to: b.guest.email,
      language: b.guest.language,
      userId: b.guest.id,
      context: { oglas: b.listing.title },
      buttonUrl: this.bookingUrl(b.id),
    });
  }

  private async sendCancelled(bookingId: string, reason?: string | null) {
    const b = await this.load(bookingId);
    if (!b) return;
    await Promise.all(
      [b.guest, b.owner].map((recipient) =>
        this.email.send({
          key: 'booking_cancelled',
          to: recipient.email,
          language: recipient.language,
          userId: recipient.id,
          context: { oglas: b.listing.title, razlog: reason || b.cancellationReason || '' },
          buttonUrl: this.bookingUrl(b.id),
        }),
      ),
    );
  }

  @OnEvent('booking.cancelled_by_owner')
  async onCancelledByOwner({ bookingId }: { bookingId: string }) {
    await this.sendCancelled(bookingId);
  }

  @OnEvent('booking.cancelled_by_guest')
  async onCancelledByGuest({ bookingId }: { bookingId: string }) {
    await this.sendCancelled(bookingId);
  }

  @OnEvent('booking.cancelled_account_deleted')
  async onCancelledAccountDeleted({ bookingId }: { bookingId: string }) {
    await this.sendCancelled(bookingId, 'Nalog druge strane je obrisan');
  }

  @OnEvent('booking.reminder_day_before')
  async onReminderDayBefore({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await Promise.all(
      [b.guest, b.owner].map((recipient) =>
        this.email.send({
          key: 'booking_reminder_day_before',
          to: recipient.email,
          language: recipient.language,
          userId: recipient.id,
          context: { oglas: b.listing.title },
          buttonUrl: this.bookingUrl(b.id),
        }),
      ),
    );
  }

  @OnEvent('booking.no_show')
  async onNoShow({ bookingId }: { bookingId: string }) {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.email.send({
      key: 'booking_no_show_marked',
      to: b.guest.email,
      language: b.guest.language,
      userId: b.guest.id,
      context: { oglas: b.listing.title },
      buttonUrl: this.bookingUrl(b.id),
    });
  }
}
