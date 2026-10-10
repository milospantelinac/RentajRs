import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateBookingRequestDto } from './create-booking-request.dto';

/** T136: the new term, in the same fields a booking request takes (a slot, months, or dates and times). */
export class ChangeTermDto extends PickType(CreateBookingRequestDto, [
  'startsAt',
  'endsAt',
  'definedSlotId',
  'monthStart',
  'monthCount',
] as const) {}

/** T136: the new term and what the guest tells the owner about it. */
export class RequestBookingChangeDto extends ChangeTermDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  guestMessage?: string;
}

/** T136: the owner's answer when they turn a change down. */
export class RejectBookingChangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
