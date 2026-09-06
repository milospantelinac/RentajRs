import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class WorkingHoursRow {
  @ApiProperty({ minimum: 1, maximum: 7, description: 'ISO day of week, Monday=1' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  startsAt: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  endsAt: string;
}

export class SetWorkingHoursDto {
  @ApiProperty({ type: [WorkingHoursRow] })
  @IsArray()
  @ArrayMaxSize(21) // up to 3 ranges/day * 7 days
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursRow)
  hours: WorkingHoursRow[];
}

export class CreateDefinedSlotDto {
  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiProperty({ required: false, description: 'RSD, overrides the listing base price for this slot' })
  @IsOptional()
  price?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBookings?: number;
}

export class CreateManualBlockDto {
  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SetDatePriceDto {
  @ApiProperty({ example: '2026-12-31', description: 'Calendar date (YYYY-MM-DD), not a timestamp' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.DATE_INVALID' })
  date: string;

  @ApiProperty({ description: 'RSD, overrides the listing base/weekend price for this one date' })
  @IsInt()
  @IsPositive()
  price: number;
}

class HourlyPriceRangeRow {
  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: 7,
    description: 'ISO day of week, Monday=1; omitted = applies to every day (T104 per-day mode)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiProperty({ example: '10:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  startTime: string;

  @ApiProperty({ example: '18:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  endTime: string;

  @ApiProperty({ description: 'RSD per hour for this window' })
  @IsInt()
  @IsPositive()
  price: number;
}

/**
 * "Različita cena po delu radnog vremena" (Dodavanje Oglasa spec §2/§3) —
 * full replace, same pattern as SetWorkingHoursDto.
 */
export class SetHourlyPriceRangesDto {
  @ApiProperty({ type: [HourlyPriceRangeRow] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HourlyPriceRangeRow)
  ranges: HourlyPriceRangeRow[];
}

export class SetSlotPriceOverrideDto {
  @ApiProperty({ example: '2026-12-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.DATE_INVALID' })
  date: string;

  @ApiProperty({ example: '14:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  startTime: string;

  @ApiProperty({ example: '16:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  endTime: string;

  @ApiProperty({ description: 'RSD per hour for this one date + time window' })
  @IsInt()
  @IsPositive()
  price: number;
}

export class AddIcalSourceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsUrl()
  url: string;
}
