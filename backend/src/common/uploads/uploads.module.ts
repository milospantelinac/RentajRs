import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UploadsService } from './uploads.service';
import { StorageService } from './storage.service';
import { StorageSettingsService } from './storage-settings.service';
import { StorageHealthService } from './storage-health.service';
import { StorageScanService } from './storage-scan.service';
import { StorageLookupService } from './storage-lookup.service';
import { UploadsMigrationService } from './uploads-migration.service';
import { MediaUrlInterceptor } from './media-url.interceptor';
import { LegacyUploadsController } from './legacy-uploads.controller';
import { LocalMediaController } from './local-media.controller';
import { StorageAdminController, UploadLimitsController } from './storage-admin.controller';
import { VideoStorageService } from './video-storage.service';
import { VideoFilesController } from './video-files.controller';

@Global()
@Module({
  controllers: [
    LegacyUploadsController,
    LocalMediaController,
    StorageAdminController,
    UploadLimitsController,
    VideoFilesController,
  ],
  providers: [
    StorageService,
    StorageSettingsService,
    UploadsService,
    StorageHealthService,
    StorageScanService,
    StorageLookupService,
    UploadsMigrationService,
    // Videos stay on this server's disk, whatever STORAGE_DRIVER says.
    VideoStorageService,
    { provide: APP_INTERCEPTOR, useClass: MediaUrlInterceptor },
  ],
  exports: [StorageService, StorageSettingsService, UploadsService, VideoStorageService],
})
export class UploadsModule {}
