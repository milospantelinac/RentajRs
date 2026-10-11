/**
 * T143: tries the storage this backend is set up with (the same check as
 * Administracija > Skladište and the 15-minute health check, storage-probe.ts).
 *
 *   docker exec rentaj_backend node dist/src/scripts/check-storage.js
 * Locally, from backend/: npx ts-node --transpile-only src/scripts/check-storage.ts
 * (with the local driver the backend has to be running: it serves the files).
 */
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from '../config/configuration';
import { StorageService } from '../common/uploads/storage.service';
import { probeStorage } from '../common/uploads/storage-probe';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] })],
  providers: [StorageService],
})
class CheckStorageModule {}

const DESCRIPTIONS = {
  write_public: 'write a public file',
  read_public: 'read it by its public URL, without keys',
  public_not_listed: 'the public side does not list its files',
  write_private: 'write a private file',
  private_signed: 'the private file opens with a signed link',
  private_locked: 'the private file does not open without one',
  cleanup: 'delete both',
};

async function main() {
  const logger = new Logger('CheckStorage');
  const app = await NestFactory.createApplicationContext(CheckStorageModule, { logger: ['error', 'warn', 'log'] });
  const storage = app.get(StorageService);
  logger.log(`Driver ${storage.driverName}, public files read from ${storage.publicBaseUrl}`);
  const result = await probeStorage(storage);
  for (const check of result.checks) {
    if (check.ok) logger.log(`OK    ${DESCRIPTIONS[check.name]}`);
    else logger.error(`FAIL  ${DESCRIPTIONS[check.name]}: ${check.detail ?? ''}`);
  }
  if (result.versioning) logger.log(`Versioning: public ${result.versioning.public}, private ${result.versioning.private}`);
  await app.close();
  if (!result.ok) process.exit(1);
  logger.log(`Storage works (${result.latencyMs} ms)`);
}

main().catch((error) => {
  new Logger('CheckStorage').error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
