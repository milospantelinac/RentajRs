import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { StorageItemReason } from '@prisma/client';
import { POLICY_LIMITS, ScanFrequency } from '../storage-settings.service';

export class StoragePricingDto {
  @ApiProperty()
  @IsNumber()
  @Min(POLICY_LIMITS.money.min)
  @Max(POLICY_LIMITS.money.max)
  baseMonthlyEur: number;

  @ApiProperty()
  @IsNumber()
  @Min(POLICY_LIMITS.money.min)
  @Max(POLICY_LIMITS.money.max)
  includedTb: number;

  @ApiProperty()
  @IsNumber()
  @Min(POLICY_LIMITS.money.min)
  @Max(POLICY_LIMITS.money.max)
  extraTbEur: number;
}

export class UpdateStorageSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(POLICY_LIMITS.retentionDays.min)
  @Max(POLICY_LIMITS.retentionDays.max)
  listingPhotoRetentionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(POLICY_LIMITS.retentionDays.min)
  @Max(POLICY_LIMITS.retentionDays.max)
  accountAttachmentRetentionDays?: number;

  @ApiPropertyOptional({ enum: ['off', 'daily', 'weekly'] })
  @IsOptional()
  @IsIn(['off', 'daily', 'weekly'])
  scanFrequency?: ScanFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(POLICY_LIMITS.uploadMb.min)
  @Max(POLICY_LIMITS.uploadMb.max)
  photoMaxMb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(POLICY_LIMITS.uploadMb.min)
  @Max(POLICY_LIMITS.uploadMb.max)
  attachmentMaxMb?: number;

  @ApiPropertyOptional({ type: StoragePricingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoragePricingDto)
  pricing?: StoragePricingDto;
}

export class StorageItemIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class StorageItemsQueryDto {
  @ApiPropertyOptional({ enum: StorageItemReason })
  @IsOptional()
  @IsEnum(StorageItemReason)
  reason?: StorageItemReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}

export class StartMigrationDto {
  @ApiProperty()
  @IsBoolean()
  dryRun: boolean;
}

export class StorageLookupQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  q: string;
}
