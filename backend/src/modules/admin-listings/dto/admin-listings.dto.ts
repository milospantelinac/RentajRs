import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { ListingStatus } from '@prisma/client';

export const PERIOD_UNITS = ['MONTHS', 'DAYS'] as const;
export const PERIOD_MODES = ['EXTEND', 'SET', 'UNLIMITED', 'END_NOW'] as const;
export const FEATURED_DAYS = [7, 15, 30] as const;
export const LIST_FILTERS = ['free', 'admin'] as const;

/** Administracija > Oglasi: one page of every listing. */
export class AdminListingsQueryDto {
  @ApiPropertyOptional({ description: 'Title, or the owner name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiPropertyOptional({ enum: LIST_FILTERS, description: 'free: on a package an admin gave; admin: added by an admin' })
  @IsOptional()
  @IsIn(LIST_FILTERS)
  filter?: (typeof LIST_FILTERS)[number];

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class OwnerSearchQueryDto {
  @ApiPropertyOptional({ description: 'Name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

/** A draft an admin adds for an existing user (the user, 2026-10-22: existing users only). */
export class CreateAdminListingDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;
}

/** Publishing an admin's listing without payment. */
export class PublishFreeListingDto {
  @ApiProperty()
  @IsUUID()
  packageId: string;

  @ApiProperty({ enum: [...PERIOD_UNITS, 'UNLIMITED'] })
  @IsIn([...PERIOD_UNITS, 'UNLIMITED'])
  duration: (typeof PERIOD_UNITS)[number] | 'UNLIMITED';

  @ApiPropertyOptional({ description: 'Months or days; not with UNLIMITED' })
  @ValidateIf((dto: PublishFreeListingDto) => dto.duration !== 'UNLIMITED')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ enum: FEATURED_DAYS, description: 'A free featured slot from now on' })
  @IsOptional()
  @Type(() => Number)
  @IsIn(FEATURED_DAYS)
  featuredDays?: (typeof FEATURED_DAYS)[number];

  @ApiPropertyOptional({ description: 'For the admins only' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** "Trajanje": what an admin does to the end of a listing's package. */
export class ChangePeriodDto {
  @ApiProperty({ enum: PERIOD_MODES })
  @IsIn(PERIOD_MODES)
  mode: (typeof PERIOD_MODES)[number];

  @ApiPropertyOptional()
  @ValidateIf((dto: ChangePeriodDto) => dto.mode === 'EXTEND' || dto.mode === 'SET')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ enum: PERIOD_UNITS })
  @ValidateIf((dto: ChangePeriodDto) => dto.mode === 'EXTEND' || dto.mode === 'SET')
  @IsIn(PERIOD_UNITS)
  unit?: (typeof PERIOD_UNITS)[number];
}
