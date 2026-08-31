import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const REJECTION_REASONS = [
  'MISSING_PHOTOS',
  'INAPPROPRIATE_CONTENT',
  'CONTACT_INFO_IN_DESCRIPTION',
  'PRICE_OUT_OF_RANGE',
  'INCOMPLETE_INFORMATION',
  'SUSPECTED_FRAUD',
  'DUPLICATE_LISTING',
  'OTHER',
] as const;

/** §12.4 — rejection always carries a reason from a fixed list, with optional free text. */
export class RejectListingDto {
  @ApiProperty({ enum: REJECTION_REASONS })
  @IsIn(REJECTION_REASONS)
  reason: (typeof REJECTION_REASONS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
