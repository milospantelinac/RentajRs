import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotCommonPassword } from '../../../common/validators/not-common-password.validator';

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
