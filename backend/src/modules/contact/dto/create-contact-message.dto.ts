import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @ApiProperty({ description: '"Saglasan/a sam da Rentaj.rs obradi moje podatke..." — must be explicitly checked.' })
  @IsIn([true], { message: 'validation.TERMS_NOT_ACCEPTED' })
  consent: boolean;

  @ApiPropertyOptional({ description: 'Honeypot — a real visitor never sees or fills this field; left here, the submission is silently dropped.' })
  @IsOptional()
  @IsString()
  website?: string;
}
