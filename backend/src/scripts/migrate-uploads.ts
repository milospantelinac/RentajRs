/**
 * T143: moves the files uploaded before Object Storage to where they are kept
 * now (UploadsMigrationService does the work; Administracija > Skladište has
 * the same as buttons). Run with the backend's own environment; --dry-run
 * only counts:
 *   docker exec rentaj_backend node dist/src/scripts/migrate-uploads.js --dry-run
 *   docker exec rentaj_backend node dist/src/scripts/migrate-uploads.js
 * Locally, from backend/: npx ts-node --transpile-only src/scripts/migrate-uploads.ts
 */
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from '../config/configuration';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../common/cache/cache.module';
import { StorageService } from '../common/uploads/storage.service';
import { MigrationType, UploadsMigrationService } from '../common/uploads/uploads-migration.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, CacheModule],
  providers: [StorageService, UploadsMigrationService],
})
class MigrateUploadsModule {}

const LABELS: Record<MigrationType, string> = {
  listingPhoto: 'Listing photos',
  avatar: 'Avatars',
  categoryImage: 'Category pictures',
  homepagePoster: 'Homepage poster',
  attachment: 'Message attachments',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const logger = new Logger('MigrateUploads');
  const app = await NestFactory.createApplicationContext(MigrateUploadsModule, { logger: ['error', 'warn', 'log'] });
  try {
    const report = await app.get(UploadsMigrationService).migrate(dryRun, (line) => logger.warn(line));
    for (const count of report.counts) {
      logger.log(
        `${LABELS[count.type]}: ${count.moved} ${dryRun ? 'to move' : 'moved'}, ${count.missing} missing on disk, ${count.refused} refused`,
      );
    }
    if (!report.counts.length) logger.log('Nothing left to move');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  new Logger('MigrateUploads').error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
