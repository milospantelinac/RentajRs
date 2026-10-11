import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { StorageService } from './common/uploads/storage.service';
import { i18nValidationExceptionFactory } from './common/i18n/validation-error.factory';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false, // configured explicitly below, origin locked to the frontend
  });

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('apiPrefix')!;

  app.use(
    helmet({
      // Pictures served from this origin (the local storage driver's /media/,
      // and the old /uploads/ addresses until T143's migration) are embedded
      // as <img> on the frontend's origin (different port in dev, different
      // subdomain in prod) — Helmet's default same-origin CORP silently
      // blocks the browser from ever painting them (fails with
      // net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin), even though the request
      // itself succeeds, which is why this doesn't show up via curl/Postman.
      // These are public images with no per-viewer sensitivity, so
      // cross-origin is the correct policy, not a weakened one.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: config.get<string>('frontendUrl'),
    credentials: true,
  });
  app.set('trust proxy', 1);

  // T143: uploads live in Object Storage on the server. Outside the API
  // prefix: the old /uploads/ addresses (LegacyUploadsController) and, on a
  // developer's machine, the local storage driver's /media/ and /media-private/.
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'uploads/(.*)', method: RequestMethod.GET },
      { path: 'media-private/(.*)', method: RequestMethod.GET },
    ],
  });
  const localStorage = app.get(StorageService).localDriver;
  if (localStorage) {
    app.useStaticAssets(localStorage.publicRoot, { prefix: '/media/', index: false, maxAge: '365d', immutable: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: i18nValidationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.get('env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Rentaj API')
      .setDescription(
        'Rental marketplace API — listings, search, bookings, subscriptions, reviews, messaging, admin.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('port')!;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Rentaj API listening on :${port}/${apiPrefix} (docs at /${apiPrefix}/docs)`);
}

bootstrap();
