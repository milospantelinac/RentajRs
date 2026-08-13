"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../../prisma/prisma.service");
const uploads_service_1 = require("../../common/uploads/uploads.service");
const money_1 = require("../../common/utils/money");
const DELETION_TOKEN_TTL_MS = 60 * 60_000;
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
};
let UsersService = class UsersService {
    constructor(prisma, uploads, i18n, events) {
        this.prisma = prisma;
        this.uploads = uploads;
        this.i18n = i18n;
        this.events = events;
    }
    async isOwner(userId) {
        const count = await this.prisma.listing.count({ where: { userId, status: 'ACTIVE' } });
        return count > 0;
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ME_SELECT });
        const [isOwner, permissionCount] = await Promise.all([
            this.isOwner(userId),
            this.prisma.userPermission.count({ where: { userId } }),
        ]);
        return { ...user, isOwner, isAdmin: permissionCount > 0 };
    }
    async updateMe(userId, dto) {
        const user = await this.prisma.user.update({ where: { id: userId }, data: dto, select: ME_SELECT });
        return user;
    }
    async setAvatar(userId, file) {
        const { url } = await this.uploads.saveImage(file, 'avatars', { maxWidth: 400, maxHeight: 400 });
        await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
        return { avatarUrl: url };
    }
    async ensureProfileSlug(userId) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.profileSlug)
            return user.profileSlug;
        const base = slugify(`${user.firstName}-${user.lastName}`) || 'vlasnik';
        let candidate = base;
        let suffix = 1;
        while (await this.prisma.user.findUnique({ where: { profileSlug: candidate } })) {
            suffix += 1;
            candidate = `${base}-${suffix}`;
        }
        await this.prisma.user.update({ where: { id: userId }, data: { profileSlug: candidate } });
        return candidate;
    }
    async getPublicProfile(slug) {
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
        if (!user)
            throw new common_1.NotFoundException();
        const ratings = user.reviewsReceived.map((r) => r.rating);
        const avgRating = ratings.length >= 3 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        return {
            ...user,
            avgRating,
            reviewCount: ratings.length,
            listings: user.listings.map((l) => ({ ...l, price: (0, money_1.paraToRsd)(l.price) })),
        };
    }
    async listFavorites(userId) {
        const favorites = await this.prisma.favorite.findMany({
            where: { userId },
            orderBy: { addedAt: 'desc' },
            include: {
                listing: {
                    include: { photos: { where: { isCover: true }, take: 1 }, city: true, category: { select: { slug: true } } },
                },
            },
        });
        return favorites.map((f) => ({
            ...f,
            priceAtAdd: (0, money_1.paraToRsd)(f.priceAtAdd),
            priceDropped: f.listing.price < f.priceAtAdd,
            listing: { ...f.listing, price: (0, money_1.paraToRsd)(f.listing.price) },
        }));
    }
    async addFavorite(userId, listingId) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
        return this.prisma.favorite.upsert({
            where: { userId_listingId: { userId, listingId } },
            update: {},
            create: { userId, listingId, priceAtAdd: listing.price },
        });
    }
    async removeFavorite(userId, listingId) {
        await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async exportUserData(userId) {
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
                price: (0, money_1.paraToRsd)(l.price),
                weekendPrice: (0, money_1.paraToRsd)(l.weekendPrice),
                pricePerGuest: (0, money_1.paraToRsd)(l.pricePerGuest),
            })),
            bookingsAsGuest: bookingsAsGuest.map((b) => ({
                ...b,
                pricePerUnit: (0, money_1.paraToRsd)(b.pricePerUnit),
                totalAmount: (0, money_1.paraToRsd)(b.totalAmount),
                amountDue: (0, money_1.paraToRsd)(b.amountDue),
            })),
            reviews,
            favorites: favorites.map((f) => ({ ...f, priceAtAdd: (0, money_1.paraToRsd)(f.priceAtAdd) })),
        };
    }
    async requestAccountDeletion(userId) {
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
    async confirmAccountDeletion(rawToken) {
        const tokenHash = this.hashToken(rawToken);
        const user = await this.prisma.user.findFirst({ where: { pendingDeletionTokenHash: tokenHash } });
        if (!user || !user.pendingDeletionExpiresAt || user.pendingDeletionExpiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException(this.i18n.t('errors.INVALID_OR_EXPIRED_TOKEN'));
        }
        return this.executeDeletion(user.id);
    }
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    async executeDeletion(userId) {
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        uploads_service_1.UploadsService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], UsersService);
function slugify(input) {
    const map = {
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
//# sourceMappingURL=users.service.js.map