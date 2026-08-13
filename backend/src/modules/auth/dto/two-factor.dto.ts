import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmTwoFactorSetupDto {
  @ApiProperty({ description: '6-digit TOTP code from the authenticator app, confirming setup' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class DisableTwoFactorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
