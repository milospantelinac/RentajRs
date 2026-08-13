import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  ValidateNested,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ enum: BookingModel })
  @IsEnum(BookingModel)
  defaultBookingModel: BookingModel;

  @ApiProperty({ enum: PriceUnit, isArray: true })
  @IsArray()
  @IsEnum(PriceUnit, { each: true })
  allowedPriceUnits: PriceUnit[];

  @ApiProperty({ enum: PriceUnit })
  @IsEnum(PriceUnit)
  defaultPriceUnit: PriceUnit;

  @ApiPropertyOptional()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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

class AttributeOptionInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpsertAttributeDto {
  @ApiProperty({ description: 'Machine key, e.g. "kvadratura" — immutable once set' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['NUMBER', 'TEXT', 'LIST', 'MULTISELECT', 'BOOLEAN'] })
  @IsEnum(['NUMBER', 'TEXT', 'LIST', 'MULTISELECT', 'BOOLEAN'])
  type: 'NUMBER' | 'TEXT' | 'LIST' | 'MULTISELECT' | 'BOOLEAN';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFilter?: boolean;

  @ApiPropertyOptional({ enum: ['RANGE', 'SELECT', 'TOGGLE'] })
  @IsOptional()
  @IsEnum(['RANGE', 'SELECT', 'TOGGLE'])
  filterType?: 'RANGE' | 'SELECT' | 'TOGGLE';

  @ApiPropertyOptional()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ type: [AttributeOptionInput], description: 'Required when type is LIST/MULTISELECT' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionInput)
  options?: AttributeOptionInput[];
}
