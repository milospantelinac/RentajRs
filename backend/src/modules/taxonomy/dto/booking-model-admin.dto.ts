import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PriceUnit } from '@prisma/client';

/** T129 part 3: what the admin sets on a booking model. */
export class UpdateBookingModelDto {
  @ApiPropertyOptional({ description: 'The name the owner sees in the wizard' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ description: 'Off: offered to no new listing; the ones on it stay' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: PriceUnit, isArray: true, description: 'A subset of the units the model can take' })
  @IsOptional()
  @IsArray()
  @IsEnum(PriceUnit, { each: true })
  priceUnits?: PriceUnit[];
}

export class ReorderModelsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keys: string[];
}

/** T129 part 4: one row of the category x model table. */
export class SetCategoryModelsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  modelKeys: string[];

  @ApiPropertyOptional({ enum: PriceUnit, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PriceUnit, { each: true })
  allowedPriceUnits?: PriceUnit[];

  @ApiPropertyOptional({ enum: PriceUnit })
  @IsOptional()
  @IsEnum(PriceUnit)
  defaultPriceUnit?: PriceUnit;
}
