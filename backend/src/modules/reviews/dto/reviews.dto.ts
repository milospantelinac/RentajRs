import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const GUEST_TAGS = ['ARRIVED_ON_TIME', 'RETURNED_NEATLY', 'COMMUNICATIVE', 'LATE', 'DAMAGE', 'NO_SHOW'] as const;

export class CreateReviewDto {
  @ApiProperty()
  @IsUUID('4')
  bookingId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ enum: GUEST_TAGS, isArray: true, description: 'Owner-to-guest direction only' })
  @IsOptional()
  @IsArray()
  @IsIn(GUEST_TAGS, { each: true })
  tags?: (typeof GUEST_TAGS)[number][];
}

export class ReplyToReviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
