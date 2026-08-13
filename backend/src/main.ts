import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { i18nValidationExceptionFactory } from './common/i18n/validation-error.factory';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false, // configured explicitly below, origin locked to the frontend
  });

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('apiPrefix')!;

  app.use(
    helmet({
      // Listing photos/avatars are served from this origin but embedded as
      // <img> on the frontend's origin (different port in dev, different
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

  app.setGlobalPrefix(apiPrefix);
  app.useStaticAssets(join(process.cwd(), config.get<string>('uploads.dir')!), {
    prefix: '/uploads/',
  });

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
