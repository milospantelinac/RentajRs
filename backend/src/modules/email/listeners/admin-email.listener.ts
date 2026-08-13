import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

@Injectable()
export class AdminEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  /** Every trigger in this listener goes to every admin holding the relevant permission (R123-adjacent: nothing here is a stored "role"). */
  private async getAdmins(permissionKey: string) {
    const grants = await this.prisma.userPermission.findMany({
      where: { permission: { key: permissionKey } },
      include: { user: true },
    });
    return grants.map((g) => g.user);
  }

  private async sendToAdmins(permissionKey: string, key: string, context: Record<string, string>, buttonUrl: string) {
    const admins = await this.getAdmins(permissionKey);
    await Promise.all(
      admins.map((admin) =>
        this.email.send({ key, to: admin.email, language: admin.language, userId: admin.id, context, buttonUrl }),
      ),
    );
  }

  @OnEvent('listing.submitted_for_approval')
  async onNewListing({ listingId }: { listingId: string }) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return;
    await this.sendToAdmins(
      'approve_listing',
      'admin_new_listing_to_review',
      { oglas: listing.title },
      `${this.frontendUrl}/admin`,
    );
  }

  @OnEvent('taxonomy.category_proposed')
  async onCategoryProposed({ categoryId }: { categoryId: string }) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return;
    const name = await this.prisma.translation.findFirst({
      where: { entityType: 'CATEGORY', entityId: categoryId, field: 'name' },
    });
    await this.sendToAdmins(
      'manage_categories',
      'admin_proposed_category',
      { kategorija: name?.value ?? category.slug },
      `${this.frontendUrl}/admin/kategorije`,
    );
  }

  @OnEvent('admin.listing_reported')
  async onListingReported({ listingId }: { listingId: string }) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return;
    await this.sendToAdmins(
      'resolve_disputes',
      'admin_listing_reported',
      { oglas: listing.title },
      `${this.frontendUrl}/admin/sporovi`,
    );
  }

  @OnEvent('booking.payment_disputed')
  async onPaymentDisputed({ bookingId }: { bookingId: string }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { title: true } } },
    });
    if (!booking) return;
    await this.sendToAdmins(
      'resolve_disputes',
      'admin_payment_disputed',
      { oglas: booking.listing.title },
      `${this.frontendUrl}/admin/sporovi`,
    );
  }

  @OnEvent('booking.no_show_disputed')
  async onNoShowDisputed({ bookingId }: { bookingId: string }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { title: true } } },
    });
    if (!booking) return;
    await this.sendToAdmins(
      'resolve_disputes',
      'admin_no_show_disputed',
      { oglas: booking.listing.title },
      `${this.frontendUrl}/admin/sporovi`,
    );
  }

  /** R182 — off by default toggle; kept useful only "in the first months" per Ch.22.4. */
  @OnEvent('booking.requested')
  async onNewBooking({ bookingId }: { bookingId: string }) {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'admin_new_booking_notifications' } });
    if (setting?.value !== true) return;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { title: true } } },
    });
    if (!booking) return;
    await this.sendToAdmins(
      'resolve_disputes',
      'admin_new_booking',
      { oglas: booking.listing.title },
      `${this.frontendUrl}/admin`,
    );
  }
}
