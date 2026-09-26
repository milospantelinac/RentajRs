import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NotCommonPassword } from '../../../common/validators/not-common-password.validator';
import { undefinedIfBlank } from '../../../common/validators/undefined-if-blank.transform';

/** §6.1 — registration never asks for a role; account starts as GUEST (R13/R14). */
export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Optional at sign-up (Dizajn 16); same format rule as the profile form.' })
  @IsOptional()
  @undefinedIfBlank
  @Matches(/^\+?[0-9\s()-]{6,20}$/, { message: 'validation.PHONE_INVALID' })
  phone?: string;

  @ApiProperty()
  @NotCommonPassword()
  password: string;

  @ApiProperty({ description: 'Terms & privacy policy version the user is accepting, e.g. "1.0"' })
  @IsString()
  @IsNotEmpty()
  termsVersion: string;

  @ApiProperty({ required: false, description: 'Honeypot field — must stay empty (anti-bot, R177)' })
  @IsOptional()
  @IsString()
  website?: string;
}
