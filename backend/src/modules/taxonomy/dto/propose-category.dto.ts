import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BookingModel, PriceUnit } from '@prisma/client';

/** §5.1 — a listing owner proposes a subcategory while creating a listing (ADR-001). */
export class ProposeCategoryDto {
  @ApiProperty()
  @IsUUID('4')
  parentId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: BookingModel })
  @IsEnum(BookingModel)
  bookingModel: BookingModel;

  @ApiProperty({ enum: PriceUnit })
  @IsEnum(PriceUnit)
  priceUnit: PriceUnit;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
