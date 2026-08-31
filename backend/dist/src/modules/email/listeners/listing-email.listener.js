"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
let ListingEmailListener = class ListingEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async loadListingAndOwner(listingId) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing)
            return null;
        const owner = await this.prisma.user.findUnique({ where: { id: listing.userId } });
        if (!owner)
            return null;
        return { listing, owner };
    }
    async onSubmitted({ listingId }) {
        const data = await this.loadListingAndOwner(listingId);
        if (!data)
            return;
        await this.email.send({
            key: 'listing_submitted_for_approval',
            to: data.owner.email,
            language: data.owner.language,
            userId: data.owner.id,
            context: { oglas: data.listing.title },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/oglasi`,
        });
    }
    async onApproved({ listingId }) {
        const data = await this.loadListingAndOwner(listingId);
        if (!data)
            return;
        await this.email.send({
            key: 'listing_approved',
            to: data.owner.email,
            language: data.owner.language,
            userId: data.owner.id,
            context: { oglas: data.listing.title },
            buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.slug}`,
        });
    }
    async onRejected({ listingId, reason }) {
        const data = await this.loadListingAndOwner(listingId);
        if (!data)
            return;
        await this.email.send({
            key: 'listing_rejected',
            to: data.owner.email,
            language: data.owner.language,
            userId: data.owner.id,
            context: { oglas: data.listing.title, razlog: reason },
            buttonUrl: `${this.frontendUrl}/oglasi/${data.listing.id}/uredi`,
        });
    }
    async onFavoritePriceDropped({ userId, listingId }) {
        const [user, listing] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: userId } }),
            this.prisma.listing.findUnique({ where: { id: listingId } }),
        ]);
        if (!user || !listing)
            return;
        await this.email.send({
            key: 'listing_price_dropped',
            to: user.email,
            language: user.language,
            userId,
            context: { oglas: listing.title },
            buttonUrl: `${this.frontendUrl}/oglasi/${listing.slug}`,
        });
    }
};
exports.ListingEmailListener = ListingEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('listing.submitted_for_approval'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ListingEmailListener.prototype, "onSubmitted", null);
__decorate([
    (0, event_emitter_1.OnEvent)('listing.approved'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ListingEmailListener.prototype, "onApproved", null);
__decorate([
    (0, event_emitter_1.OnEvent)('listing.rejected'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ListingEmailListener.prototype, "onRejected", null);
__decorate([
    (0, event_emitter_1.OnEvent)('listing.favorite_price_dropped'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ListingEmailListener.prototype, "onFavoritePriceDropped", null);
exports.ListingEmailListener = ListingEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], ListingEmailListener);
//# sourceMappingURL=listing-email.listener.js.map