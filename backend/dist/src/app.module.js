"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const throttler_1 = require("@nestjs/throttler");
const bullmq_1 = require("@nestjs/bullmq");
const configuration_1 = __importDefault(require("./config/configuration"));
const prisma_module_1 = require("./prisma/prisma.module");
const cache_module_1 = require("./common/cache/cache.module");
const uploads_module_1 = require("./common/uploads/uploads.module");
const geocoding_module_1 = require("./common/geocoding/geocoding.module");
const payment_module_1 = require("./common/payment/payment.module");
const fiscalization_module_1 = require("./common/fiscalization/fiscalization.module");
const i18n_module_1 = require("./i18n/i18n.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const permissions_guard_1 = require("./common/guards/permissions.guard");
const app_controller_1 = require("./app.controller");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const taxonomy_module_1 = require("./modules/taxonomy/taxonomy.module");
const content_module_1 = require("./modules/content/content.module");
const listings_module_1 = require("./modules/listings/listings.module");
const search_module_1 = require("./modules/search/search.module");
const availability_module_1 = require("./modules/availability/availability.module");
const bookings_module_1 = require("./modules/bookings/bookings.module");
const messaging_module_1 = require("./modules/messaging/messaging.module");
const reviews_module_1 = require("./modules/reviews/reviews.module");
const subscriptions_module_1 = require("./modules/subscriptions/subscriptions.module");
const admin_module_1 = require("./modules/admin/admin.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const email_module_1 = require("./modules/email/email.module");
const contact_module_1 = require("./modules/contact/contact.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default] }),
            prisma_module_1.PrismaModule,
            cache_module_1.CacheModule,
            uploads_module_1.UploadsModule,
            geocoding_module_1.GeocodingModule,
            payment_module_1.PaymentModule,
            fiscalization_module_1.FiscalizationModule,
            i18n_module_1.AppI18nModule,
            schedule_1.ScheduleModule.forRoot(),
            event_emitter_1.EventEmitterModule.forRoot(),
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    throttlers: [
                        {
                            ttl: config.get('rateLimit.ttlSeconds') * 1000,
                            limit: config.get('rateLimit.maxRequests'),
                        },
                    ],
                }),
            }),
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        host: config.get('redis.host'),
                        port: config.get('redis.port'),
                    },
                }),
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            taxonomy_module_1.TaxonomyModule,
            content_module_1.ContentModule,
            listings_module_1.ListingsModule,
            search_module_1.SearchModule,
            availability_module_1.AvailabilityModule,
            bookings_module_1.BookingsModule,
            messaging_module_1.MessagingModule,
            reviews_module_1.ReviewsModule,
            subscriptions_module_1.SubscriptionsModule,
            admin_module_1.AdminModule,
            dashboard_module_1.DashboardModule,
            notifications_module_1.NotificationsModule,
            email_module_1.EmailModule,
            contact_module_1.ContactModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: permissions_guard_1.PermissionsGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map