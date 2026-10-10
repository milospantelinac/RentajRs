import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
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

  // Dizajn 22: required, a slot without its own price was booked at the listing's price (0 for defined slots).
  @ApiProperty({ description: 'RSD for this slot' })
  @IsInt()
  @IsPositive()
  price: number;

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

/**
 * T141: step 3's one block of working hours with their prices, saved in one
 * go. The wizard sends each day's windows (periods that touch make one
 * window, a gap between periods is a break) and each period's own price.
 */
export class SetWorkingScheduleDto {
  @ApiProperty({ type: [WorkingHoursRow] })
  @IsArray()
  @ArrayMaxSize(84) // up to 12 windows a day * 7 days
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursRow)
  hours: WorkingHoursRow[];

  @ApiProperty({ type: [HourlyPriceRangeRow] })
  @IsArray()
  @ArrayMaxSize(84)
  @ValidateNested({ each: true })
  @Type(() => HourlyPriceRangeRow)
  ranges: HourlyPriceRangeRow[];
}

class SlotTemplateRow {
  @ApiProperty({ example: '10:00', description: 'Belgrade wall-clock start' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  startTime: string;

  @ApiProperty({ example: '12:00', description: 'At or before the start runs past midnight' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  endTime: string;

  @ApiProperty({ description: 'RSD for the slot, or per guest when the listing is priced per guest' })
  @IsInt()
  @IsPositive()
  price: number;
}

/** T141 "Napravi termine": the same slots on every chosen weekday of a date range. */
export class GenerateDefinedSlotsDto {
  @ApiProperty({ type: [Number], description: 'ISO days of week, Monday=1' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days: number[];

  @ApiProperty({ type: [SlotTemplateRow] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SlotTemplateRow)
  slots: SlotTemplateRow[];

  @ApiProperty({ example: '2026-09-26', description: 'First calendar day (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.DATE_INVALID' })
  from: string;

  @ApiProperty({ example: '2026-12-31', description: 'Last calendar day (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.DATE_INVALID' })
  to: string;
}

/** T141 "Izmeni": one defined slot's day, times and price, in Belgrade time. */
export class UpdateDefinedSlotDto {
  @ApiProperty({ example: '2026-09-12' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.DATE_INVALID' })
  date: string;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  startTime: string;

  @ApiProperty({ example: '10:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' })
  endTime: string;

  @ApiProperty({ description: 'RSD for this slot' })
  @IsInt()
  @IsPositive()
  price: number;
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
  // Dizajn 33: the page only asks for the address and names the calendar after it.
  @ApiProperty({ required: false, description: 'Defaults to the platform named by the address' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiProperty({ example: 'https://www.airbnb.com/calendar/ical/123.ics?s=abc' })
  @IsUrl({ protocols: ['http', 'https', 'webcal'], require_protocol: true }, { message: 'validation.ICAL_URL_INVALID' })
  @MaxLength(2000, { message: 'validation.ICAL_URL_INVALID' })
  url: string;
}
