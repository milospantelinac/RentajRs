import { Body, ConflictException, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { StorageService } from './storage.service';
import { POLICY_LIMITS, StorageSettingsService } from './storage-settings.service';
import { StorageHealthService } from './storage-health.service';
import { StorageScanService } from './storage-scan.service';
import { StorageLookupService } from './storage-lookup.service';
import { UploadsMigrationService } from './uploads-migration.service';
import {
  StartMigrationDto,
  StorageItemIdsDto,
  StorageItemsQueryDto,
  StorageLookupQueryDto,
  UpdateStorageSettingsDto,
} from './dto/storage-admin.dto';

/**
 * T143: Administracija > Skladište. Everything about stored files on one
 * page: the connection (read only, it stays in the environment) and its
 * check, the retention periods and upload limits, the storage check's list
 * of files that could go (deleted only when an admin approves), usage, the
 * move of the files from before T143, a lookup by link and the history.
 */
@ApiTags('admin')
@RequirePermissions('manage_storage')
@Controller('admin/storage')
export class StorageAdminController {
  constructor(
    private storage: StorageService,
    private settings: StorageSettingsService,
    private health: StorageHealthService,
    private scans: StorageScanService,
    private lookups: StorageLookupService,
    private migration: UploadsMigrationService,
    private prisma: PrismaService,
    private i18n: I18nService,
  ) {}

  @Get()
  async overview() {
    const [policy, scans, pending, overdue, holds, legacy] = await Promise.all([
      this.settings.get(),
      this.scans.latestScans(12),
      this.scans.pendingSummary(),
      this.scans.overdueAccountAttachments(),
      this.prisma.storageHold.count(),
      this.migration.legacyCounts(),
    ]);
    const run = this.migration.lastRun();
    const names = await this.scans.userNames([...scans.map((scan) => scan.triggeredById), run?.startedById ?? null]);
    return {
      connection: this.storage.describe(),
      health: this.health.status(),
      settings: policy,
      defaults: this.settings.defaults(),
      limits: POLICY_LIMITS,
      scans: scans.map((scan) => ({
        id: scan.id,
        status: scan.status,
        trigger: scan.trigger,
        triggeredBy: scan.triggeredById ? (names.get(scan.triggeredById) ?? null) : null,
        startedAt: scan.startedAt,
        finishedAt: scan.finishedAt,
        error: scan.error,
        warning: scan.warning,
        usage: scan.usage,
      })),
      pending,
      overdueAccountAttachments: overdue,
      holds,
      migration: {
        legacy,
        run: run ? { ...run, startedBy: run.startedById ? (names.get(run.startedById) ?? null) : null } : null,
      },
    };
  }

  @Put('settings')
  async updateSettings(@CurrentUser('id') adminId: string, @Body() dto: UpdateStorageSettingsDto) {
    const { before, after } = await this.settings.update(dto);
    await this.scans.log(adminId, 'storage.settings_updated', before, after);
    return after;
  }

  @Post('health')
  checkNow() {
    return this.health.check();
  }

  @Post('scans')
  async startScan(@CurrentUser('id') adminId: string) {
    const { scan } = await this.scans.start('manual', adminId);
    return { id: scan.id, status: scan.status, startedAt: scan.startedAt };
  }

  @Get('items')
  items(@Query() query: StorageItemsQueryDto) {
    return this.scans.items(query);
  }

  @Post('items/delete')
  deleteItems(@CurrentUser('id') adminId: string, @Body() dto: StorageItemIdsDto) {
    return this.scans.deleteItems(adminId, dto.ids);
  }

  @Post('items/keep')
  keepItems(@CurrentUser('id') adminId: string, @Body() dto: StorageItemIdsDto) {
    return this.scans.keepItems(adminId, dto.ids);
  }

  @Get('holds')
  holds() {
    return this.scans.holds();
  }

  @Delete('holds/:id')
  removeHold(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.scans.removeHold(adminId, id);
  }

  @Post('migration')
  async startMigration(@CurrentUser('id') adminId: string, @Body() dto: StartMigrationDto) {
    if (this.migration.isRunning()) throw new ConflictException(this.i18n.t('errors.STORAGE_MIGRATION_RUNNING'));
    await this.scans.log(adminId, 'storage.migration_started', null, { dryRun: dto.dryRun });
    const run = this.migration.startFromAdmin(adminId, dto.dryRun, async (finished) => {
      if (!finished.dryRun) {
        await this.scans.log(adminId, 'storage.migration_finished', null, {
          status: finished.status,
          counts: finished.report?.counts ?? [],
          error: finished.error,
        });
      }
    });
    return run;
  }

  @Get('lookup')
  lookup(@Query() query: StorageLookupQueryDto) {
    return this.lookups.lookup(query.q);
  }

  /** The storage page's own entries of the admin log, newest first. */
  @Get('history')
  async history() {
    const rows = await this.prisma.adminLog.findMany({
      where: { entityType: 'Storage' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      at: row.createdAt,
      by: `${row.user.firstName} ${row.user.lastName}`.trim(),
      oldValue: row.oldValue,
      newValue: row.newValue,
    }));
  }
}

/** T143: the upload limits set in Administracija > Skladište, for the pages that check a file before sending it. */
@ApiTags('content')
@Controller()
export class UploadLimitsController {
  constructor(private settings: StorageSettingsService) {}

  @Public()
  @Get('upload-limits')
  uploadLimits() {
    return this.settings.uploadLimits();
  }
}
