import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BuyerType, Language } from '@prisma/client';
import { undefinedIfBlank } from '../../../common/validators/undefined-if-blank.transform';
import { IsBankAccount } from '../../../common/validators/bank-account.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @undefinedIfBlank
  @Matches(/^\+?[0-9\s()-]{6,20}$/, { message: 'validation.PHONE_INVALID' })
  phone?: string;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({ description: 'Serbian current account (tekući račun), needed to accept bookings' })
  @IsOptional()
  @undefinedIfBlank
  @IsString()
  @IsBankAccount({ message: 'validation.BANK_ACCOUNT_INVALID' })
  bankAccount?: string;

  @ApiPropertyOptional({ enum: BuyerType })
  @IsOptional()
  @IsEnum(BuyerType)
  buyerType?: BuyerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ description: 'PIB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string;

  @ApiPropertyOptional({ description: 'Matični broj' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  billingAddress?: string;
}
