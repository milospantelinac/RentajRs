import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class ExtraServiceSelection {
  @ApiProperty()
  @IsUUID('4')
  serviceId: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBookingRequestDto {
  @ApiPropertyOptional({ description: 'Required unless bookingSlotId is given' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Booking a pre-defined slot (PER_SLOT + DEFINED_SLOTS)' })
  @IsOptional()
  @IsUUID('4')
  definedSlotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestMessage?: string;

  @ApiPropertyOptional({ type: [ExtraServiceSelection] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExtraServiceSelection)
  extraServices?: ExtraServiceSelection[];
}
