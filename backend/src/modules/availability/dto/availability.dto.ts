import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
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
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startsAt: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
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

export class AddIcalSourceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsUrl()
  url: string;
}
