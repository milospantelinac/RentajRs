import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

const REPORT_REASONS = ['FRAUD', 'INACCURATE_INFO', 'INAPPROPRIATE_CONTENT', 'DUPLICATE', 'OTHER'] as const;
const DISPUTE_OUTCOMES = ['WARNING', 'RESTRICTION', 'BLOCK', 'NO_ACTION', 'OVERTURN_NO_SHOW'] as const;

export class ReportListingDto {
  @ApiProperty({ enum: REPORT_REASONS })
  @IsIn(REPORT_REASONS)
  reason: (typeof REPORT_REASONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class BlockUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: DISPUTE_OUTCOMES })
  @IsIn(DISPUTE_OUTCOMES)
  outcome: (typeof DISPUTE_OUTCOMES)[number];

  @ApiPropertyOptional({ description: 'Account the outcome applies to — WARNING/RESTRICTION/BLOCK are never automatic (Ch.6.7: admin decides about the account, never about money)' })
  @IsOptional()
  @IsUUID('4')
  targetUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class UpdateSettingDto {
  @ApiProperty()
  @IsDefined()
  value: unknown;
}

export class UpdateEmailTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  heading: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bodyText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buttonLabel?: string;
}

export class UpdateStaticPageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'HTML produced by the admin Rich Text Editor' })
  @IsString()
  @IsNotEmpty()
  bodyHtml: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class CreateFaqDto {
  @ApiProperty({ enum: ['SR', 'EN'] })
  @IsIn(['SR', 'EN'])
  language: 'SR' | 'EN';

  // "+ Dodaj pitanje" (admin/sadrzaj.vue) creates a blank placeholder row for
  // the admin to fill in inline via PATCH — not a fully-formed FAQ up front —
  // so these can't require non-empty content the way UpdateFaqDto's do.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  answer?: string;
}

export class UpdateFaqDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  answer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
