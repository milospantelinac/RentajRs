import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/**
 * storeKey/apiPassword are optional here on purpose — omitting them (or
 * sending the masked placeholder the GET endpoint returns) leaves the
 * currently-stored encrypted value untouched. See PaymentSettingsService.update().
 */
export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Omit or send unchanged to keep the current Store Key' })
  @IsOptional()
  @IsString()
  storeKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiUsername?: string;

  @ApiPropertyOptional({ description: 'Omit or send unchanged to keep the current API password' })
  @IsOptional()
  @IsString()
  apiPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  okUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  failUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiEndpoint?: string;

  @ApiPropertyOptional({ enum: ['Auth', 'PreAuth'] })
  @IsOptional()
  @IsIn(['Auth', 'PreAuth'])
  transactionType?: 'Auth' | 'PreAuth';

  @ApiPropertyOptional({ enum: ['RSD', 'EUR'] })
  @IsOptional()
  @IsIn(['RSD', 'EUR'])
  currency?: 'RSD' | 'EUR';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantTaxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantAddress?: string;
}
