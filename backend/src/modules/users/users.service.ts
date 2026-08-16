import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../common/uploads/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { paraToRsd } from '../../common/utils/money';

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

  /** Public owner profile — §13.3: never exposes contact info or reviews the owner wrote about guests. */
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
          where: { published: true, direction: 'GUEST_TO_OWNER', hiddenByAdmin: false },
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

  async listFavorites(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        listing: {
          include: { photos: { where: { isCover: true }, take: 1 }, city: true, category: { select: { slug: true } } },
        },
      },
    });
    // Price-drop signal (Ch.10 "Ako stigne" item) — compare today's price to the price when saved.
    // Prisma's BigInt (para) fields must be converted before this crosses into JSON — see money.ts.
    return favorites.map((f) => ({
      ...f,
      priceAtAdd: paraToRsd(f.priceAtAdd),
      priceDropped: f.listing.price < f.priceAtAdd,
      listing: { ...f.listing, price: paraToRsd(f.listing.price) },
    }));
  }

  async addFavorite(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    return this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      update: {},
      create: { userId, listingId, priceAtAdd: listing.price },
    });
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
        where: { userId, status: { in: ['ACTIVE', 'GRACE', 'PENDING_ACTIVATION'] } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), autoRenew: false },
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
