import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { TaxonomyService } from '../../taxonomy/taxonomy.service';
import { formatDate, localeFor } from '../format';

/**
 * T129, istaknuti oglasi: the owner hears when a period starts, when it waits
 * for a place in a full category, a week (or two days) before it ends, when
 * it has ended and when a request is declined; the admins who manage featured
 * listings hear about every new request (FeaturedService emits all of these).
 */
@Injectable()
export class FeaturedEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private taxonomy: TaxonomyService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  private get myListingsUrl() {
    return `${this.frontendUrl}/kontrolna-tabla/oglasi`;
  }

  private async period(featuredId: string) {
    return this.prisma.featuredListing.findUnique({
      where: { id: featuredId },
      include: { listing: { include: { user: true } } },
    });
  }

  private async request(requestId: string) {
    return this.prisma.featuredRequest.findUnique({
      where: { id: requestId },
      include: { listing: { include: { user: true } } },
    });
  }

  @OnEvent('featured.started')
  async onStarted({ featuredId }: { featuredId: string }) {
    const period = await this.period(featuredId);
    if (!period) return;
    const owner = period.listing.user;
    await this.email.send({
      key: 'featured_started',
      to: owner.email,
      language: owner.language,
      userId: owner.id,
      context: { oglas: period.listing.title, datum: formatDate(period.expiresAt, localeFor(owner.language)) },
      buttonUrl: this.myListingsUrl,
    });
  }

  @OnEvent('featured.waiting')
  async onWaiting({ requestId }: { requestId: string }) {
    const request = await this.request(requestId);
    if (!request) return;
    const owner = request.listing.user;
    const names = await this.taxonomy.getCategoryNames([request.listing.categoryId], owner.language);
    await this.email.send({
      key: 'featured_waiting',
      to: owner.email,
      language: owner.language,
      userId: owner.id,
      context: { oglas: request.listing.title, kategorija: names.get(request.listing.categoryId) ?? '' },
      buttonUrl: this.myListingsUrl,
    });
  }

  @OnEvent('featured.ending_soon')
  async onEndingSoon({ featuredId }: { featuredId: string }) {
    const period = await this.period(featuredId);
    if (!period) return;
    const owner = period.listing.user;
    await this.email.send({
      key: 'featured_ending_soon',
      to: owner.email,
      language: owner.language,
      userId: owner.id,
      context: { oglas: period.listing.title, datum: formatDate(period.expiresAt, localeFor(owner.language)) },
      buttonUrl: this.myListingsUrl,
    });
  }

  @OnEvent('featured.ended')
  async onEnded({ featuredId }: { featuredId: string }) {
    const period = await this.period(featuredId);
    if (!period) return;
    const owner = period.listing.user;
    await this.email.send({
      key: 'featured_ended',
      to: owner.email,
      language: owner.language,
      userId: owner.id,
      context: { oglas: period.listing.title },
      buttonUrl: this.myListingsUrl,
    });
  }

  @OnEvent('featured.request_rejected')
  async onRejected({ requestId }: { requestId: string }) {
    const request = await this.request(requestId);
    if (!request) return;
    const owner = request.listing.user;
    await this.email.send({
      key: 'featured_request_rejected',
      to: owner.email,
      language: owner.language,
      userId: owner.id,
      context: { oglas: request.listing.title, razlog: request.decisionNote || '-' },
      buttonUrl: this.myListingsUrl,
    });
  }

  @OnEvent('featured.requested')
  async onRequested({ requestId }: { requestId: string }) {
    const request = await this.request(requestId);
    if (!request) return;
    const owner = request.listing.user;
    const grants = await this.prisma.userPermission.findMany({
      where: { permission: { key: 'manage_featured' } },
      include: { user: true },
    });
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email;
    await Promise.all(
      grants.map(({ user: admin }) =>
        this.email.send({
          key: 'admin_featured_request',
          to: admin.email,
          language: admin.language,
          userId: admin.id,
          context: { oglas: request.listing.title, korisnik: ownerName },
          buttonUrl: `${this.frontendUrl}/admin/istaknuti-oglasi?tab=requests`,
        }),
      ),
    );
  }
}
