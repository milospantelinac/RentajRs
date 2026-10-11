import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type ScanFrequency = 'off' | 'daily' | 'weekly';

/** T143: what Administracija > Skladište sets. The connection itself stays in the environment. */
export interface StoragePolicy {
  /** Days the photos of a deleted listing are kept before the check lists them. */
  listingPhotoRetentionDays: number;
  /** Days the attachments a deleted account sent are kept before the check lists them. */
  accountAttachmentRetentionDays: number;
  /** How often the check runs on its own; it never deletes anything. */
  scanFrequency: ScanFrequency;
  photoMaxMb: number;
  attachmentMaxMb: number;
  /** For the cost estimate: Hetzner's monthly base, the storage it includes and the price of each further TB. */
  pricing: { baseMonthlyEur: number; includedTb: number; extraTbEur: number };
}

// Every key starts with storage_, which keeps them off the general settings
// page (AdminService.listSettings): they are set here, with their limits.
const KEYS = {
  listingPhotoRetentionDays: 'storage_listing_photo_retention_days',
  accountAttachmentRetentionDays: 'storage_account_attachment_retention_days',
  scanFrequency: 'storage_scan_frequency',
  photoMaxMb: 'storage_photo_max_mb',
  attachmentMaxMb: 'storage_attachment_max_mb',
  pricing: 'storage_pricing',
} as const satisfies Record<keyof StoragePolicy, string>;

export const STORAGE_SETTING_PREFIX = 'storage_';

// The upload limits stay under multer's own cap (UPLOAD_LIMITS, 20 MB).
export const POLICY_LIMITS = {
  retentionDays: { min: 1, max: 365 },
  uploadMb: { min: 1, max: 20 },
  money: { min: 0, max: 100000 },
};

const FREQUENCIES: ScanFrequency[] = ['off', 'daily', 'weekly'];

@Injectable()
export class StorageSettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /** The defaults: 30 days as decided on 2026-10-11, a weekly check, Hetzner's prices of 2026. */
  defaults(): StoragePolicy {
    return {
      listingPhotoRetentionDays: 30,
      accountAttachmentRetentionDays: 30,
      scanFrequency: 'weekly',
      photoMaxMb: this.config.get<number>('uploads.maxPhotoSizeMb') ?? 8,
      attachmentMaxMb: 5,
      pricing: { baseMonthlyEur: 6.49, includedTb: 1, extraTbEur: 8.7 },
    };
  }

  /** The policy in force. A missing or unusable row (the general settings API takes anything) counts as its default. */
  async get(): Promise<StoragePolicy> {
    const rows = await this.prisma.setting.findMany({ where: { key: { startsWith: STORAGE_SETTING_PREFIX } } });
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    const defaults = this.defaults();
    const pricing = value(KEYS.pricing) as Record<string, unknown> | undefined;
    return {
      listingPhotoRetentionDays: intIn(value(KEYS.listingPhotoRetentionDays), POLICY_LIMITS.retentionDays, defaults.listingPhotoRetentionDays),
      accountAttachmentRetentionDays: intIn(
        value(KEYS.accountAttachmentRetentionDays),
        POLICY_LIMITS.retentionDays,
        defaults.accountAttachmentRetentionDays,
      ),
      scanFrequency: FREQUENCIES.includes(value(KEYS.scanFrequency) as ScanFrequency)
        ? (value(KEYS.scanFrequency) as ScanFrequency)
        : defaults.scanFrequency,
      photoMaxMb: intIn(value(KEYS.photoMaxMb), POLICY_LIMITS.uploadMb, defaults.photoMaxMb),
      attachmentMaxMb: intIn(value(KEYS.attachmentMaxMb), POLICY_LIMITS.uploadMb, defaults.attachmentMaxMb),
      pricing: {
        baseMonthlyEur: numberIn(pricing?.baseMonthlyEur, POLICY_LIMITS.money, defaults.pricing.baseMonthlyEur),
        includedTb: numberIn(pricing?.includedTb, POLICY_LIMITS.money, defaults.pricing.includedTb),
        extraTbEur: numberIn(pricing?.extraTbEur, POLICY_LIMITS.money, defaults.pricing.extraTbEur),
      },
    };
  }

  async uploadLimits(): Promise<{ photoMaxMb: number; attachmentMaxMb: number }> {
    const { photoMaxMb, attachmentMaxMb } = await this.get();
    return { photoMaxMb, attachmentMaxMb };
  }

  /** Saves what changed (already checked by the DTO) and returns the policy before and after, for the admin log. */
  async update(changes: Partial<StoragePolicy>): Promise<{ before: StoragePolicy; after: StoragePolicy }> {
    const before = await this.get();
    const after: StoragePolicy = { ...before, ...changes, pricing: { ...before.pricing, ...(changes.pricing ?? {}) } };
    const writes = (Object.keys(KEYS) as Array<keyof StoragePolicy>)
      .filter((field) => JSON.stringify(after[field]) !== JSON.stringify(before[field]))
      .map((field) =>
        this.prisma.setting.upsert({
          where: { key: KEYS[field] },
          create: { key: KEYS[field], value: after[field] as any, description: 'Administracija > Skladište (T143)' },
          update: { value: after[field] as any },
        }),
      );
    if (writes.length) await this.prisma.$transaction(writes);
    return { before, after };
  }
}

function intIn(value: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max ? value : fallback;
}

function numberIn(value: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max ? value : fallback;
}
