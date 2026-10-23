import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeaturedRequestStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminGrantFeaturedDto {
  @ApiProperty()
  @IsUUID('4')
  listingId: string;

  @ApiPropertyOptional({ description: 'Days from now; the rules default when left out' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: "The admin's own note, never shown to the owner" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdminChangeFeaturedEndDto {
  @ApiProperty({ description: 'The new end; a moment already past ends the period now' })
  @IsDateString()
  expiresAt: string;
}

export class AdminApproveFeaturedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: "Use the owner's one free leader period (its length comes from the leaders' rule)" })
  @IsOptional()
  @IsBoolean()
  asLeader?: boolean;
}

export class AdminRejectFeaturedDto {
  @ApiProperty({ description: 'Shown to the owner' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class AdminFeaturedRequestsQueryDto {
  @ApiPropertyOptional({ enum: FeaturedRequestStatus, description: 'Without it: the open ones (PENDING and WAITING)' })
  @IsOptional()
  @IsEnum(FeaturedRequestStatus)
  status?: FeaturedRequestStatus;
}

export class AdminFeaturedPeriodsQueryDto {
  @ApiPropertyOptional({ enum: ['live', 'ended'] })
  @IsOptional()
  @IsIn(['live', 'ended'])
  state?: 'live' | 'ended';
}

export class AdminLeaderRuleDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD, or null for no rule (only leaders added by hand)', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  cutoffDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class AdminSetLeaderDto {
  @ApiPropertyOptional({ description: 'true: a leader by hand, false: kept out, null: the rule decides', nullable: true })
  @IsOptional()
  @IsBoolean()
  override?: boolean | null;
}

export class AdminGrantLeaderDto {
  @ApiPropertyOptional({ description: "Which of the leader's live listings; by default the first that went live" })
  @IsOptional()
  @IsUUID('4')
  listingId?: string;
}

export class AdminFeaturedRulesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  searchTopCount?: number;

  @IsOptional()
  @IsInt()
  homeDesktopCount?: number;

  @IsOptional()
  @IsInt()
  homePhoneCount?: number;

  @IsOptional()
  @IsInt()
  homeIntervalSeconds?: number;

  @IsOptional()
  @IsInt()
  maxPerCategory?: number;

  @ApiPropertyOptional({ description: "Category id to its own limit; a category left out uses maxPerCategory" })
  @IsOptional()
  @IsObject()
  categoryLimits?: Record<string, number>;

  @IsOptional()
  @IsInt()
  maxPerOwnerPerCategory?: number;

  @IsOptional()
  @IsInt()
  defaultDays?: number;
}

export class AdminRankingWeightsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rating?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  freshness?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  responseTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  random?: number;
}
