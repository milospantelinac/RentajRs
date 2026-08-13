import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class AttributeFilterInput {
  @IsUUID('4')
  attributeId: string;

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsBoolean()
  boolean?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  optionIds?: string[];
}

/**
 * POST body rather than a GET querystring — a nested attribute-filter array
 * and map-bounds object don't serialize cleanly as query params, and search
 * results aren't meaningfully cacheable per-URL anyway (R146 mixes in
 * randomness on every call).
 */
export class SearchListingsDto {
  @ApiPropertyOptional({ description: 'Free-text search across title/description' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cityAreaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ description: 'ISO date — availability start' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — availability end' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({ description: 'R38 — only listings that accept online reservations' })
  @IsOptional()
  @IsBoolean()
  onlineBookingOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ type: [AttributeFilterInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeFilterInput)
  attributes?: AttributeFilterInput[];

  @ApiPropertyOptional({ description: 'Map viewport bounds, all four required together' })
  @IsOptional()
  @IsNumber()
  mapNorth?: number;

  @IsOptional()
  @IsNumber()
  mapSouth?: number;

  @IsOptional()
  @IsNumber()
  mapEast?: number;

  @IsOptional()
  @IsNumber()
  mapWest?: number;

  @ApiPropertyOptional({ enum: ['relevance', 'price_asc', 'price_desc', 'newest'] })
  @IsOptional()
  @IsIn(['relevance', 'price_asc', 'price_desc', 'newest'])
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

export class RelaxedSearchNotifyDto {
  @IsOptional()
  @IsString()
  email?: string;
}
