import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Dizajn 43: the guest's review of a completed booking, public once sent. */
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
}

/** Dizajn 43: the author's change, for review_edit_days after the review went public. */
export class UpdateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Empty clears the comment' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReplyToReviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
