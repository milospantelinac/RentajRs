import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: '2026-09', description: '"Po mesecu" (PER_STAY + priceUnit=MONTH) — first day of this month is the booking start; used instead of startsAt/endsAt' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'validation.DATE_INVALID' })
  monthStart?: string;

  @ApiPropertyOptional({ description: '"Po mesecu" — number of whole calendar months, required together with monthStart' })
  @IsOptional()
  @IsInt()
  @Min(1)
  monthCount?: number;

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

  // T76 — required only when the listing's own paymentMethod is BOTH; the
  // guest's actual choice between the two, never BOTH itself.
  @ApiPropertyOptional({ enum: ['CASH', 'BANK_TRANSFER'], description: 'Required when the listing accepts both payment methods' })
  @IsOptional()
  @IsIn(['CASH', 'BANK_TRANSFER'])
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
}
