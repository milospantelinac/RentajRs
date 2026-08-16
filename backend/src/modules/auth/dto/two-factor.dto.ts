import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Re-confirming the password here mirrors DisableTwoFactorDto — regenerating
 * a secret is just as sensitive an action as turning 2FA off outright, since
 * either one is a way to knock out an account's 2FA protection. */
export class GenerateTwoFactorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

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
