import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { undefinedIfBlank } from '../../../common/validators/undefined-if-blank.transform';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingModel, PaymentMethod, PriceUnit, SlotSubmode } from '@prisma/client';

class MandatoryFeeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  amount: number;
}

/**
 * Single partial-update DTO covering wizard steps 2 (booking model), 3
 * (basics), 7 (pricing/payment), 8 (availability rules), 10 (cancellation),
 * plus the R34 availability toggle — one endpoint instead of five nearly-
 * identical PATCH routes. ListingsService splits fields into "applies
 * immediately" vs "goes through moderation" per R31 (title/category/
 * location do; price/description/attributes/availability don't).
 */
export class UpdateListingDto {
  // Korak 2
  @ApiPropertyOptional({ enum: BookingModel })
  @IsOptional()
  @IsEnum(BookingModel)
  bookingModel?: BookingModel;

  @ApiPropertyOptional({ enum: SlotSubmode })
  @IsOptional()
  @IsEnum(SlotSubmode)
  slotSubmode?: SlotSubmode;

  // Korak 3
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  // Korak 7 — cena i nacin plaanja
  @ApiPropertyOptional({ enum: PriceUnit })
  @IsOptional()
  @IsEnum(PriceUnit)
  priceUnit?: PriceUnit;

  @ApiPropertyOptional({ description: 'Price in RSD (whole dinars; converted to para internally)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weekendPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerGuest?: number;

  @ApiPropertyOptional({ type: [MandatoryFeeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MandatoryFeeDto)
  mandatoryFees?: MandatoryFeeDto[];

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'null/omitted = full amount due' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  advancePercent?: number;

  @ApiPropertyOptional({ minimum: 12, maximum: 168 })
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(168)
  paymentDeadlineHours?: number;

  @ApiPropertyOptional({ description: 'R52 — false sends the IPS QR immediately, true requires the owner to approve first' })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  // Korak 8 — dostupnost (listing-level rules; calendar itself is the
  // Availability module)
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  minDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  minGuests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxGuests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  gapAfterMinutes?: number;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @undefinedIfBlank
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  pickupTime?: string;

  @ApiPropertyOptional({ example: '11:00' })
  @IsOptional()
  @undefinedIfBlank
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  returnTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  earliestBookingHours?: number;

  // Korak 10 — RNT-030: fixed options instead of free text, so a guest can
  // compare listings instead of reading everyone's own wording for the same
  // three policies.
  @ApiPropertyOptional({ enum: ['FLEXIBLE', 'MODERATE', 'STRICT'] })
  @IsOptional()
  @IsIn(['FLEXIBLE', 'MODERATE', 'STRICT'])
  cancellationTerms?: string;

  // R34 toggle, available on any status/package
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
