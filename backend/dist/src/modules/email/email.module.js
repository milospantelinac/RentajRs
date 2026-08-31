"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../prisma/prisma.module");
const email_module_1 = require("../../common/email/email.module");
const account_email_listener_1 = require("./listeners/account-email.listener");
const listing_email_listener_1 = require("./listeners/listing-email.listener");
const booking_email_listener_1 = require("./listeners/booking-email.listener");
const review_email_listener_1 = require("./listeners/review-email.listener");
const subscription_email_listener_1 = require("./listeners/subscription-email.listener");
const admin_email_listener_1 = require("./listeners/admin-email.listener");
const data_protection_email_listener_1 = require("./listeners/data-protection-email.listener");
const contact_email_listener_1 = require("./listeners/contact-email.listener");
const messaging_email_listener_1 = require("./listeners/messaging-email.listener");
let EmailModule = class EmailModule {
};
exports.EmailModule = EmailModule;
exports.EmailModule = EmailModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, email_module_1.CommonEmailModule],
        providers: [
            account_email_listener_1.AccountEmailListener,
            listing_email_listener_1.ListingEmailListener,
            booking_email_listener_1.BookingEmailListener,
            review_email_listener_1.ReviewEmailListener,
            subscription_email_listener_1.SubscriptionEmailListener,
            admin_email_listener_1.AdminEmailListener,
            data_protection_email_listener_1.DataProtectionEmailListener,
            contact_email_listener_1.ContactEmailListener,
            messaging_email_listener_1.MessagingEmailListener,
        ],
    })
], EmailModule);
//# sourceMappingURL=email.module.js.map