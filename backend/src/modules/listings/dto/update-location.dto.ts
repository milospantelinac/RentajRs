import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/** Korak 5 — the owner only ever types an address; region/city are picked from lists, coordinates are automatic (R40). */
export class UpdateLocationDto {
  @ApiProperty()
  @IsUUID('4')
  regionId: string;

  @ApiProperty()
  @IsUUID('4')
  cityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cityAreaId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;
}
