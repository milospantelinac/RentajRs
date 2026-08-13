import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ChargeType } from '@prisma/client';

class ExtraServiceInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ enum: ChargeType })
  @IsEnum(ChargeType)
  chargeType: ChargeType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxQuantity?: number;
}

/** R176 — optional paid add-ons the guest picks at booking time. */
export class UpsertExtraServicesDto {
  @ApiProperty({ type: [ExtraServiceInput] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExtraServiceInput)
  services: ExtraServiceInput[];
}
