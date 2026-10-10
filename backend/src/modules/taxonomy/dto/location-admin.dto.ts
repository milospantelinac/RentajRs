import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PlaceKind } from '@prisma/client';

/** T119: an okrug (Administracija > Lokacije). */
export class CreateRegionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Made from the name when left out' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;
}

export class UpdateRegionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug?: string;
}

/** T119: a place (naselje) of an okrug. */
export class CreateCityDto {
  @ApiProperty()
  @IsUUID('4')
  regionId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Made from the name (and the municipality, when the name is taken)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @ApiPropertyOptional({ enum: PlaceKind })
  @IsOptional()
  @IsEnum(PlaceKind)
  kind?: PlaceKind;

  @ApiPropertyOptional({ description: 'Locative for headings: "u Surduku"' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameLocative?: string;
}

export class UpdateCityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({ description: 'Empty clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @ApiPropertyOptional({ enum: PlaceKind })
  @IsOptional()
  @IsEnum(PlaceKind)
  kind?: PlaceKind;

  @ApiPropertyOptional({ description: 'Empty clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameLocative?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

/** T119: a part of a city (deo grada). */
export class CreateAreaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;
}

export class UpdateAreaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

/** T119: the admin's list of places, searched and paged on the server (some six thousand rows). */
export class AdminCitiesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  regionId?: string;

  @ApiPropertyOptional({ enum: ['all', 'visible', 'hidden'] })
  @IsOptional()
  @IsIn(['all', 'visible', 'hidden'])
  visibility?: 'all' | 'visible' | 'hidden';

  @ApiPropertyOptional({ description: 'Only places that have listings' })
  @IsOptional()
  @IsIn(['0', '1'])
  withListings?: '0' | '1';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
