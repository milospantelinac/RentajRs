import { StorageSettingsService } from './storage-settings.service';

const config = { get: jest.fn(() => 8) };

function makePrisma(rows: Array<{ key: string; value: unknown }>) {
  return {
    setting: {
      findMany: jest.fn(async () => rows),
      upsert: jest.fn((args: any) => args),
    },
    $transaction: jest.fn(async (ops: any[]) => ops),
  };
}

describe('StorageSettingsService (T143)', () => {
  it('uses the defaults where nothing is set: 30 days, weekly, 8 and 5 MB, Hetzner 2026 prices', async () => {
    const service = new StorageSettingsService(makePrisma([]) as any, config as any);
    expect(await service.get()).toEqual({
      listingPhotoRetentionDays: 30,
      accountAttachmentRetentionDays: 30,
      scanFrequency: 'weekly',
      photoMaxMb: 8,
      attachmentMaxMb: 5,
      pricing: { baseMonthlyEur: 6.49, includedTb: 1, extraTbEur: 8.7 },
    });
  });

  it('reads saved values and ignores unusable ones (the general settings API takes anything)', async () => {
    const service = new StorageSettingsService(
      makePrisma([
        { key: 'storage_listing_photo_retention_days', value: 60 },
        { key: 'storage_account_attachment_retention_days', value: 'abc' },
        { key: 'storage_scan_frequency', value: 'daily' },
        { key: 'storage_photo_max_mb', value: 50 },
        { key: 'storage_attachment_max_mb', value: 10 },
        { key: 'storage_pricing', value: { baseMonthlyEur: 7, includedTb: -1 } },
      ]) as any,
      config as any,
    );
    expect(await service.get()).toEqual({
      listingPhotoRetentionDays: 60,
      accountAttachmentRetentionDays: 30,
      scanFrequency: 'daily',
      photoMaxMb: 8,
      attachmentMaxMb: 10,
      pricing: { baseMonthlyEur: 7, includedTb: 1, extraTbEur: 8.7 },
    });
    expect(await service.uploadLimits()).toEqual({ photoMaxMb: 8, attachmentMaxMb: 10 });
  });

  it('writes only what changed, and says what it was before', async () => {
    const prisma = makePrisma([{ key: 'storage_scan_frequency', value: 'weekly' }]);
    const service = new StorageSettingsService(prisma as any, config as any);

    const { before, after } = await service.update({ scanFrequency: 'off', pricing: { extraTbEur: 9 } as any });

    expect(before.scanFrequency).toBe('weekly');
    expect(after).toMatchObject({ scanFrequency: 'off', pricing: { baseMonthlyEur: 6.49, includedTb: 1, extraTbEur: 9 } });
    expect(prisma.setting.upsert.mock.calls.map(([args]: any) => args.where.key)).toEqual([
      'storage_scan_frequency',
      'storage_pricing',
    ]);
  });
});
