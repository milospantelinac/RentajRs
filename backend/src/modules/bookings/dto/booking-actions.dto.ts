import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DisputeNoShowDto {
  // T90 — the admin previously received disputes with no explanation at all
  // (there was nowhere for the guest to write one); now required.
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  explanation: string;
}
