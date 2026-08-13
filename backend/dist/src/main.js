"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const path_1 = require("path");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const validation_error_factory_1 = require("./common/i18n/validation-error.factory");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        cors: false,
    });
    const config = app.get(config_1.ConfigService);
    const apiPrefix = config.get('apiPrefix');
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    app.enableCors({
        origin: config.get('frontendUrl'),
        credentials: true,
    });
    app.set('trust proxy', 1);
    app.setGlobalPrefix(apiPrefix);
    app.useStaticAssets((0, path_1.join)(process.cwd(), config.get('uploads.dir')), {
        prefix: '/uploads/',
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: validation_error_factory_1.i18nValidationExceptionFactory,
    }));
    app.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    if (config.get('env') !== 'production') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('Rentaj API')
            .setDescription('Rental marketplace API — listings, search, bookings, subscriptions, reviews, messaging, admin.')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
            swaggerOptions: { persistAuthorization: true },
        });
    }
    const port = config.get('port');
    await app.listen(port, '0.0.0.0');
    console.log(`Rentaj API listening on :${port}/${apiPrefix} (docs at /${apiPrefix}/docs)`);
}
bootstrap();
//# sourceMappingURL=main.js.map