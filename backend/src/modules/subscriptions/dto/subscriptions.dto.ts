import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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

/** ZADATAK 1 — checkout page → POST /subscriptions/checkout/init. */
export class InitCheckoutDto {
  @ApiProperty()
  @IsUUID('4')
  listingId: string;

  @ApiProperty()
  @IsUUID('4')
  packageId: string;

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: '"Želim račun na firmu (Pravno lice)"' })
  @IsBoolean()
  isCompany: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string; // PIB

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string; // Matični broj

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiProperty({ description: 'Must be true — checkbox confirming the terms of use and privacy policy were read and accepted.' })
  @IsIn([true], { message: 'validation.TERMS_NOT_ACCEPTED' })
  termsAccepted: boolean;
}

export class AdjustPriceDto {
  @ApiProperty()
  @IsInt()
  priceMonthlyRsd: number;

  @ApiProperty()
  @IsInt()
  priceYearlyRsd: number;
}

/** R145 — admin manually grants a featured slot without a charge. */
export class AssignFreeFeaturedDto {
  @ApiProperty({ enum: [7, 15, 30] })
  @IsIn([7, 15, 30])
  durationDays: 7 | 15 | 30;
}
