import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../common/uploads/uploads.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { paraToRsd } from '../../common/utils/money';
import { LISTING_CARD_INCLUDE, loadListingCardNames, serializeListingCard } from '../../common/utils/listing-card';

const DELETION_TOKEN_TTL_MS = 60 * 60_000; // 1h — matches the password-reset token lifetime

const ME_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  emailVerified: true,
  phone: true,
  avatarUrl: true,
  language: true,
  buyerType: true,
  companyName: true,
  taxId: true,
  registrationNumber: true,
  billingAddress: true,
  bankAccount: true,
  verified: true,
  twoFactorEnabled: true,
  profileSlug: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
    private i18n: I18nService,
    private events: EventEmitter2,
    private taxonomy: TaxonomyService,
  ) {}

  /** R13: "owner" is never stored — it's whether the user has >=1 ACTIVE listing. Single source of truth — see AuthService/DashboardService. */
  async isOwner(userId: string): Promise<boolean> {
    const count = await this.prisma.listing.count({ where: { userId, status: 'ACTIVE' } });
    return count > 0;
  }

  /** P6/R12: "admin" has no stored role either — same derivation as owner, just off holding any permission grant at all. */
  async isAdmin(userId: string): Promise<boolean> {
    const count = await this.prisma.userPermission.count({ where: { userId } });
    return count > 0;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ME_SELECT });
    const [isOwner, isAdmin] = await Promise.all([this.isOwner(userId), this.isAdmin(userId)]);
    return { ...user, isOwner, isAdmin };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto, select: ME_SELECT });
    return user;
  }

  async setAvatar(userId: string, file: Express.Multer.File) {
    const { url } = await this.uploads.saveImage(file, 'avatars', { maxWidth: 400, maxHeight: 400 });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    return { avatarUrl: url };
  }

  async removeAvatar(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    return { avatarUrl: null };
  }

  /**
   * Called by ListingsService right before a listing's first-ever publish
   * (the Gost -> Vlasnik transition, R14) — see Ch.14.2 profile URL pattern.
   * Idempotent: a user who already has a slug keeps it.
   */
  async ensureProfileSlug(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.profileSlug) return user.profileSlug;

    const base = slugify(`${user.firstName}-${user.lastName}`) || 'vlasnik';
    let candidate = base;
    let suffix = 1;
    // Collisions are rare (common names) but must never fail a listing publish.
    while (await this.prisma.user.findUnique({ where: { profileSlug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    await this.prisma.user.update({ where: { id: userId }, data: { profileSlug: candidate } });
    return candidate;
  }

  /** Public owner profile (§13.3): never exposes contact info. Its reviews are the guests' reviews of the owner's listings. */
  async getPublicProfile(slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { profileSlug: slug },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        verified: true,
        avgResponseTimeMinutes: true,
        completedBookingsCount: true,
        createdAt: true,
        listings: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            slug: true,
            title: true,
            price: true,
            priceUnit: true,
            avgRating: true,
            reviewCount: true,
            photos: { where: { isCover: true }, take: 1, select: { url: true, altText: true } },
          },
        },
        reviewsReceived: {
          where: { hiddenByAdmin: false },
          orderBy: { publishedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            rating: true,
            comment: true,
            publishedAt: true,
            author: { select: { firstName: true, avatarUrl: true } },
            reply: { select: { content: true, createdAt: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException();

    const ratings = user.reviewsReceived.map((r) => r.rating);
    const avgRating = ratings.length >= 3 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    return {
      ...user,
      avgRating,
      reviewCount: ratings.length,
      listings: user.listings.map((l) => ({ ...l, price: paraToRsd(l.price) })),
    };
  }

  // -- Favorites ---------------------------------------------------------

  /**
   * Dizajn 36: the saved page shows each listing as the very card search
   * shows (common/utils/listing-card.ts), so a guest never receives the
   * address, the iCal export token or anything else the public page keeps
   * back. Only live listings are listed, since only they have a page to open;
   * an expired, rejected or deleted one keeps its row and shows again if the
   * listing comes back. The price-drop email and bell entry still read
   * priceAtAdd (sendPriceDropNotifications).
   */
  async listFavorites(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, listing: { status: 'ACTIVE' } },
      orderBy: { addedAt: 'desc' },
      select: { listingId: true, addedAt: true, listing: { include: LISTING_CARD_INCLUDE } },
    });
    const { categoryNames, optionNames } = await loadListingCardNames(
      this.taxonomy,
      favorites.map((f) => f.listing),
    );
    return favorites.map((f) => ({
      listingId: f.listingId,
      addedAt: f.addedAt,
      listing: serializeListingCard(f.listing, categoryNames, optionNames),
    }));
  }

  async addFavorite(userId: string, listingId: string) {
    // Only a live listing has a page with a heart on it, so anything else is
    // reported as missing instead of being saved out of sight (Dizajn 36).
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, status: 'ACTIVE' },
      select: { price: true },
    });
    if (!listing) throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    const favorite = await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      update: {},
      create: { userId, listingId, priceAtAdd: listing.price },
    });
    // Same BigInt para field as listFavorites() — never crossed into JSON
    // before since nothing called this endpoint until the listing page's
    // save button (T53) actually wired it up.
    return { ...favorite, priceAtAdd: paraToRsd(favorite.priceAtAdd) };
  }

  async removeFavorite(userId: string, listingId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** R142 — full data export from the dashboard. */
  async exportUserData(userId: string) {
    const [user, listings, bookingsAsGuest, reviews, favorites] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ME_SELECT }),
      this.prisma.listing.findMany({ where: { userId } }),
      this.prisma.booking.findMany({ where: { guestId: userId } }),
      this.prisma.review.findMany({ where: { authorId: userId } }),
      this.prisma.favorite.findMany({ where: { userId } }),
    ]);
    this.events.emit('user.data_export_ready', { userId });
    return {
      exportedAt: new Date().toISOString(),
      user,
      listings: listings.map((l) => ({
        ...l,
        price: paraToRsd(l.price),
        weekendPrice: paraToRsd(l.weekendPrice),
        pricePerGuest: paraToRsd(l.pricePerGuest),
      })),
      bookingsAsGuest: bookingsAsGuest.map((b) => ({
        ...b,
        pricePerUnit: paraToRsd(b.pricePerUnit),
        totalAmount: paraToRsd(b.totalAmount),
        amountDue: paraToRsd(b.amountDue),
      })),
      reviews,
      favorites: favorites.map((f) => ({ ...f, priceAtAdd: paraToRsd(f.priceAtAdd) })),
    };
  }

  /**
   * R141 — anonymize, never hard-delete (evidentiary/financial records must
   * survive). Handles the two edge cases from Ch.2 §9: active listings are
   * hidden and their subscriptions cancelled; guests on any still-pending or
   * confirmed booking are notified their booking was cancelled.
   */
  /** Ch.22.4 "Zahtev za brisanje naloga" / R175 — deletion only executes once confirmed from the registered inbox. */
  async requestAccountDeletion(userId: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingDeletionTokenHash: tokenHash,
        pendingDeletionExpiresAt: new Date(Date.now() + DELETION_TOKEN_TTL_MS),
      },
    });
    this.events.emit('user.deletion_requested', { userId, rawToken });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** No @CurrentUser requirement — the raw token itself, only ever known by whoever received the email, is the proof (the link may be opened on a device with no active session). */
  async confirmAccountDeletion(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const user = await this.prisma.user.findFirst({ where: { pendingDeletionTokenHash: tokenHash } });
    if (!user || !user.pendingDeletionExpiresAt || user.pendingDeletionExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
    }
    return this.executeDeletion(user.id);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** The actual anonymize-and-cancel logic (Ch.2 §9) — called after user confirmation, or directly by an admin (R175). */
  async executeDeletion(userId: string) {
    const activeBookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ guestId: userId }, { ownerId: userId }],
        status: { in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'] },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const booking of activeBookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED', cancellationReason: 'Account deleted' },
        });
      }
      await tx.listing.updateMany({ where: { userId }, data: { status: 'DELETED', deletedAt: new Date() } });
      await tx.subscription.updateMany({
        where: { userId, status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'SCHEDULED'] } },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: 'Uklonjen',
          lastName: 'nalog',
          email: `deleted-${userId}@rentaj.rs`,
          phone: null,
          avatarUrl: null,
          bankAccount: null,
          taxId: null,
          registrationNumber: null,
          passwordHash: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          profileSlug: null,
          blocked: true,
          blockedReason: 'Account deleted by user',
          anonymizedAt: new Date(),
        },
      });
    });

    for (const booking of activeBookings) {
      this.events.emit('booking.cancelled_account_deleted', { bookingId: booking.id });
    }

    return { message: this.i18n.t('common.ACCOUNT_DELETED') };
  }
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    č: 'c',
    ć: 'c',
    ž: 'z',
    š: 's',
    đ: 'dj',
    Č: 'c',
    Ć: 'c',
    Ž: 'z',
    Š: 's',
    Đ: 'dj',
  };
  return input
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
