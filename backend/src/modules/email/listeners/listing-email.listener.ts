import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Language } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { formatDate, localeFor } from '../format';

/** A package's end date as an email reads it; a free package may have none. */
function validUntil(expiresAt: Date | null, language: Language): string {
  if (!expiresAt) return language === 'EN' ? 'no end date' : 'bez isteka';
  return formatDate(expiresAt, localeFor(language));
}

@Injectable()
export class ListingEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private i18n: I18nService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  private async loadListingAndOwner(listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return null;
    const owner = await this.prisma.user.findUnique({ where: { id: listing.userId } });
    if (!owner) return null;
    return { listing, owner };
  }

  @OnEvent('listing.submitted_for_approval')
  async onSubmitted({ listingId }: { listingId: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    await this.email.send({
      key: 'listing_submitted_for_approval',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/oglasi`,
    });
  }

  @OnEvent('listing.approved')
  async onApproved({ listingId }: { listingId: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    await this.email.send({
      key: 'listing_approved',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.slug}`,
    });
  }

  @OnEvent('listing.rejected')
  async onRejected({ listingId, reason, note }: { listingId: string; reason: string; note?: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    // Dizajn 29: the reason is a key, so the owner reads its label, followed by the
    // admin's note when there is one (the template closes the sentence itself).
    const lang = data.owner.language === 'EN' ? 'en' : 'sr';
    const label = this.i18n.t(`listings.REJECT_REASON.${reason}`, { lang, defaultValue: reason }) as string;
    const trimmedNote = note?.trim().replace(/[.!?]+$/, '');
    const razlog = trimmedNote ? `${label}. ${trimmedNote}` : label;
    await this.email.send({
      key: 'listing_rejected',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title, razlog },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.id}/odbijeno`,
    });
  }

  // Dizajn 18 — an "Otključaj svoju kategoriju" draft got its real category,
  // so the owner can finish it in the wizard.
  @OnEvent('listing.category_assigned')
  async onCategoryAssigned({ listingId }: { listingId: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    await this.email.send({
      key: 'listing_category_assigned',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.id}/uredi`,
    });
  }

  // Administracija > Oglasi: an admin published the listing without payment.
  @OnEvent('listing.published_by_admin')
  async onPublishedByAdmin({ listingId, subscriptionId }: { listingId: string; subscriptionId: string }) {
    const [data, subscription] = await Promise.all([this.loadListingAndOwner(listingId), this.loadPackage(subscriptionId)]);
    if (!data || !subscription) return;
    await this.email.send({
      key: 'listing_published_by_admin',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: {
        oglas: data.listing.title,
        paket: subscription.package.key,
        rok: validUntil(subscription.expiresAt, data.owner.language),
      },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.slug}`,
    });
  }

  // An admin moved the end of the listing's package (an ended one is told by subscription_expired).
  @OnEvent('listing.period_changed_by_admin')
  async onPeriodChangedByAdmin({ listingId, subscriptionId }: { listingId: string; subscriptionId: string }) {
    const [data, subscription] = await Promise.all([this.loadListingAndOwner(listingId), this.loadPackage(subscriptionId)]);
    if (!data || !subscription) return;
    await this.email.send({
      key: 'listing_period_changed',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: {
        oglas: data.listing.title,
        paket: subscription.package.key,
        rok: validUntil(subscription.expiresAt, data.owner.language),
      },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/oglasi`,
    });
  }

  private loadPackage(subscriptionId: string) {
    return this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { expiresAt: true, package: { select: { key: true } } },
    });
  }

  @OnEvent('listing.favorite_price_dropped')
  async onFavoritePriceDropped({ userId, listingId }: { userId: string; listingId: string }) {
    const [user, listing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.listing.findUnique({ where: { id: listingId } }),
    ]);
    if (!user || !listing) return;
    await this.email.send({
      key: 'listing_price_dropped',
      to: user.email,
      language: user.language,
      userId,
      context: { oglas: listing.title },
      buttonUrl: `${this.frontendUrl}/oglasi/${listing.slug}`,
    });
  }
}
