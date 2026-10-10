import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { BookingModel, PriceUnit } from '@prisma/client';

export class CreateCategoryDto {
  @ApiPropertyOptional({ description: 'Omit for a top-level (main) category' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'One line under the category card on /oglasi/novi (Dizajn 17)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ enum: BookingModel, description: 'Without modelKeys: the booking fields the models are read from' })
  @IsOptional()
  @IsEnum(BookingModel)
  defaultBookingModel?: BookingModel;

  @ApiPropertyOptional({ enum: PriceUnit, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PriceUnit, { each: true })
  allowedPriceUnits?: PriceUnit[];

  @ApiPropertyOptional({ enum: PriceUnit })
  @IsOptional()
  @IsEnum(PriceUnit)
  defaultPriceUnit?: PriceUnit;

  @ApiPropertyOptional({ type: [String], description: 'T129: the booking models it offers (BookingModelSetting keys)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modelKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'T129: the URL name; made from the name when left out' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ description: 'T129: false (the default) keeps a new category as a draft, off the site' })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ description: 'T129: copy the booking settings, attributes and filters of this category' })
  @IsOptional()
  @IsUUID('4')
  copyFromId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'T129: the URL name; the old URL redirects to the new one' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ nullable: true, description: 'T129: moves the category; null makes it a main category' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID('4')
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'One line under the category card on /oglasi/novi (Dizajn 17)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ enum: BookingModel })
  @IsOptional()
  @IsEnum(BookingModel)
  defaultBookingModel?: BookingModel;

  @ApiPropertyOptional({ enum: PriceUnit, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PriceUnit, { each: true })
  allowedPriceUnits?: PriceUnit[];

  @ApiPropertyOptional({ enum: PriceUnit })
  @IsOptional()
  @IsEnum(PriceUnit)
  defaultPriceUnit?: PriceUnit;

  @ApiPropertyOptional()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Dizajn 50: "Prikaži na sajtu", whether the site lists the category' })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

/** T129: the new order of one level of the tree, every sibling once. */
export class ReorderCategoriesDto {
  @ApiPropertyOptional({ nullable: true, description: 'Parent of that level; null for the main categories' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID('4')
  parentId?: string | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class RejectCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MergeCategoryDto {
  @ApiProperty({ description: 'Target category id that listings/URL get merged into' })
  @IsUUID('4')
  targetCategoryId: string;
}
