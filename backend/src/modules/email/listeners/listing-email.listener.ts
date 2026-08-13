import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

@Injectable()
export class ListingEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
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
  async onRejected({ listingId, reason }: { listingId: string; reason: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    await this.email.send({
      key: 'listing_rejected',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title, razlog: reason },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.id}/uredi`,
    });
  }

  @OnEvent('listing.edit_approved')
  async onEditApproved({ listingId }: { listingId: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    await this.email.send({
      key: 'listing_edit_approved',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.slug}`,
    });
  }

  @OnEvent('listing.edit_rejected')
  async onEditRejected({ listingId, reason }: { listingId: string; reason: string }) {
    const data = await this.loadListingAndOwner(listingId);
    if (!data) return;
    await this.email.send({
      key: 'listing_edit_rejected',
      to: data.owner.email,
      language: data.owner.language,
      userId: data.owner.id,
      context: { oglas: data.listing.title, razlog: reason },
      buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.id}/uredi`,
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
