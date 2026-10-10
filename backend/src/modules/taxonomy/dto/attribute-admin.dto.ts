import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AttributeType, FilterControl, FilterPlacement } from '@prisma/client';

/** T129: an icon of the frontend's attribute icon library, by its file name. */
const ICON_NAME = /^[a-z0-9-]+$/;

class NewOptionInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(ICON_NAME)
  @MaxLength(60)
  icon?: string;
}

/** T129: a field of a category; the key is made from the name and never changes. */
export class CreateAttributeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: AttributeType })
  @IsEnum(AttributeType)
  type: AttributeType;

  @ApiPropertyOptional({ description: 'm², kg, kom...' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Shown on the public listing page (default true)' })
  @IsOptional()
  @IsBoolean()
  showOnListing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(ICON_NAME)
  @MaxLength(60)
  icon?: string;

  @ApiPropertyOptional({ description: 'Shown only when this single-choice field...' })
  @IsOptional()
  @IsString()
  dependsOnAttrKey?: string;

  @ApiPropertyOptional({ description: '...has this option picked' })
  @IsOptional()
  @IsString()
  dependsOnOptionKey?: string;

  @ApiPropertyOptional({ type: [NewOptionInput], description: 'The items of a list field' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => NewOptionInput)
  options?: NewOptionInput[];
}

export class UpdateAttributeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: AttributeType, description: 'Only while no listing has a value' })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @ApiPropertyOptional({ description: 'An empty string clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showOnListing?: boolean;

  @ApiPropertyOptional({ description: 'Not offered for new listings; stays on the ones that have it' })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'null or an empty string clears it' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null && value !== '')
  @Matches(ICON_NAME)
  @MaxLength(60)
  icon?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null clears the condition' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  dependsOnAttrKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  dependsOnOptionKey?: string | null;
}

export class CreateOptionDto extends NewOptionInput {}

export class UpdateOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ nullable: true, description: 'null or an empty string clears it' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null && value !== '')
  @Matches(ICON_NAME)
  @MaxLength(60)
  icon?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

/** T129: the new order of a list, every member once. */
export class ReorderIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID('4', { each: true })
  ids: string[];
}

/** T129: one filter of the category's /pretraga (a CategoryFilter row). */
export class CreateFilterDto {
  @ApiProperty({ enum: FilterControl })
  @IsEnum(FilterControl)
  control: FilterControl;

  @ApiProperty({ enum: FilterPlacement })
  @IsEnum(FilterPlacement)
  placement: FilterPlacement;

  @ApiPropertyOptional({ description: 'The field it reads; none for AREA' })
  @IsOptional()
  @IsString()
  attributeKey?: string;

  @ApiPropertyOptional({ description: 'OPTION_TOGGLE: the item that has to be ticked' })
  @IsOptional()
  @IsString()
  optionKey?: string;

  @ApiPropertyOptional({ type: [Number], description: 'MIN and GUESTS: the "N+" choices' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  thresholds?: number[];
}

export class UpdateFilterDto {
  @ApiPropertyOptional({ enum: FilterControl })
  @IsOptional()
  @IsEnum(FilterControl)
  control?: FilterControl;

  @ApiPropertyOptional({ enum: FilterPlacement })
  @IsOptional()
  @IsEnum(FilterPlacement)
  placement?: FilterPlacement;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  thresholds?: number[];
}

/** T129: the attribute keys of the category's key facts, in order. */
export class SetFactKeysDto {
  @ApiPropertyOptional({ type: [String], description: 'Up to 3, on the listing card' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  cardFactKeys?: string[];

  @ApiPropertyOptional({ type: [String], description: "Up to 6, in the listing page's strip" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  listingFactKeys?: string[];
}
