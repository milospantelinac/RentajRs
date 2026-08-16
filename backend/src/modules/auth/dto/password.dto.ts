import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotCommonPassword } from '../../../common/validators/not-common-password.validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @NotCommonPassword()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty()
  @NotCommonPassword()
  newPassword: string;

  @ApiPropertyOptional({ description: 'The caller\'s own refresh token, so this one session survives the revoke-all-others sweep' })
  @IsOptional()
  @IsString()
  currentRefreshToken?: string;
}
