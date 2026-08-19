import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { BookingModel, PriceUnit } from '@prisma/client';

const BOOKING_CHOICES = ['PER_STAY', 'PER_SLOT', 'NO_BOOKING'] as const;
const STAY_UNITS = ['DAY', 'NIGHT', 'MONTH'] as const;
const SLOT_UNITS = ['HOUR', 'SLOT'] as const;

/**
 * "Otključaj svoju kategoriju" (Kategorije spec §8) — the owner doesn't pick
 * a category at all here; they describe the listing and Rentaj assigns the
 * real category afterward. Creates a listing under the hidden "Ostalo"
 * fallback category with pendingCategoryAssignment=true, surfaced to admins
 * in the moderation queue for manual reassignment.
 */
export class CreateUncategorizedListingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: BOOKING_CHOICES })
  @IsIn(BOOKING_CHOICES)
  bookingModel: BookingModel;

  @ApiPropertyOptional({ enum: [...STAY_UNITS, ...SLOT_UNITS] })
  @ValidateIf((o) => o.bookingModel !== 'NO_BOOKING')
  @IsIn([...STAY_UNITS, ...SLOT_UNITS])
  priceUnit?: PriceUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
