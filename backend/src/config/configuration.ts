export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    rememberMeDays: parseInt(process.env.SESSION_REMEMBER_ME_DAYS || '30', 10),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  twoFactor: {
    appName: process.env.TWO_FACTOR_APP_NAME || 'Rentaj',
  },

  mail: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    fromName: process.env.MAIL_FROM_NAME || 'Rentaj',
    fromAddress: process.env.MAIL_FROM_ADDRESS || 'no-reply@rentaj.rs',
  },

  uploads: {
    dir: process.env.UPLOADS_DIR || 'uploads',
    baseUrl: process.env.UPLOADS_BASE_URL || 'http://localhost:3001/uploads',
    maxPhotoSizeMb: parseInt(process.env.MAX_PHOTO_SIZE_MB || '8', 10),
    maxPhotosPerListing: parseInt(process.env.MAX_PHOTOS_PER_LISTING || '20', 10),
  },

  geocoding: {
    provider: process.env.GEOCODING_PROVIDER || 'nominatim',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    bancaIntesa: {
      merchantId: process.env.BANCA_INTESA_MERCHANT_ID,
      secretKey: process.env.BANCA_INTESA_SECRET_KEY,
      apiUrl: process.env.BANCA_INTESA_API_URL,
    },
  },

  fiscalization: {
    provider: process.env.FISCALIZATION_PROVIDER || 'mock',
    sparkomVp: {
      apiKey: process.env.SPARKOM_VP_API_KEY,
      apiUrl: process.env.SPARKOM_VP_API_URL,
    },
  },

  antiBot: {
    honeypotField: process.env.ANTI_BOT_HONEYPOT_FIELD || 'website',
  },

  rateLimit: {
    ttlSeconds: parseInt(process.env.RATE_LIMIT_TTL_SECONDS || '60', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10),
  },

  adminSeed: {
    email: process.env.ADMIN_SEED_EMAIL || 'admin@rentaj.rs',
    password: process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!',
  },
});
