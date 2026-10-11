import * as path from 'path';

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
    // T143: holds the files uploaded before Object Storage (served only by the
    // legacy /uploads/ route until src/scripts/migrate-uploads.ts moves them)
    // and, without STORAGE_DRIVER=s3, the local driver's media/ and private/.
    dir: process.env.UPLOADS_DIR || 'uploads',
    maxPhotoSizeMb: parseInt(process.env.MAX_PHOTO_SIZE_MB || '8', 10),
    maxPhotosPerListing: parseInt(process.env.MAX_PHOTOS_PER_LISTING || '20', 10),
  },

  storage: storageConfig(),

  geocoding: {
    provider: process.env.GEOCODING_PROVIDER || 'nominatim',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  ical: {
    // Feed addresses on loopback, private or link-local networks are refused
    // (server-side request forgery). Unset, that holds in production only, so
    // local development can read test feeds from 127.0.0.1.
    allowPrivateAddresses: process.env.ICAL_ALLOW_PRIVATE_ADDRESSES
      ? process.env.ICAL_ALLOW_PRIVATE_ADDRESSES === 'true'
      : (process.env.NODE_ENV || 'development') !== 'production',
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

/**
 * T143: where uploaded files are kept. STORAGE_DRIVER=s3 on the server:
 * Object Storage, Hetzner's (endpoint https://fsn1.your-objectstorage.com,
 * region fsn1). Unset, on a developer's machine: the disk under UPLOADS_DIR,
 * served by this backend at /media/. MEDIA_BASE_URL is where the browser
 * reads public files from; unset, the public bucket's own address or this
 * backend's /media/.
 */
function storageConfig() {
  const driver: 'local' | 's3' = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
  const s3 = {
    endpoint: trimSlash(process.env.S3_ENDPOINT),
    region: process.env.S3_REGION || 'fsn1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    publicBucket: process.env.S3_PUBLIC_BUCKET || '',
    privateBucket: process.env.S3_PRIVATE_BUCKET || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  };
  const defaultBaseUrl =
    driver === 's3'
      ? bucketAddress(s3.endpoint, s3.publicBucket, s3.forcePathStyle)
      : `http://localhost:${process.env.PORT || '3001'}/media`;
  return {
    driver,
    publicBaseUrl: trimSlash(process.env.MEDIA_BASE_URL) || defaultBaseUrl,
    localDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads'),
    // Signs the local driver's links to private files.
    linkSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    s3,
  };
}

function bucketAddress(endpoint: string, bucket: string, pathStyle: boolean): string {
  if (!endpoint || !bucket) return '';
  if (pathStyle) return `${endpoint}/${bucket}`;
  const url = new URL(endpoint);
  return `${url.protocol}//${bucket}.${url.host}`;
}

function trimSlash(value: string | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}
