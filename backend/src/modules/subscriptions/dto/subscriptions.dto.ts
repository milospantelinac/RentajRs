import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';
import { BillingCycle } from '@prisma/client';

export class PurchaseSubscriptionDto {
  @ApiProperty()
  @IsUUID('4')
  listingId: string;

  @ApiPropertyOptional({ description: 'Buy a new subscription' })
  @IsOptional()
  @IsUUID('4')
  packageId?: string;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ description: 'Attach to an existing Pro subscription with room instead of buying new' })
  @IsOptional()
  @IsUUID('4')
  existingSubscriptionId?: string;
}

export class PurchaseFeaturedDto {
  @ApiProperty()
  @IsUUID('4')
  listingId: string;

  @ApiProperty({ enum: [7, 15, 30] })
  @IsIn([7, 15, 30])
  durationDays: 7 | 15 | 30;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  reason?: string;
}

export class AdjustPriceDto {
  @ApiProperty()
  @IsInt()
  priceMonthlyRsd: number;

  @ApiProperty()
  @IsInt()
  priceYearlyRsd: number;
}
