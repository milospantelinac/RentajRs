import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { undefinedIfBlank } from '../../../common/validators/undefined-if-blank.transform';

/** Korak 5 — the owner only ever types an address; region/city are picked from lists, coordinates are automatic (R40). */
export class UpdateLocationDto {
  @ApiProperty()
  @IsUUID('4', { message: 'validation.REGION_REQUIRED' })
  regionId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'validation.CITY_REQUIRED' })
  cityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cityAreaId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  // R40 — the owner never has to type these; set only when they've dragged
  // the map pin to fine-tune the auto-geocoded position (RNT-026).
  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  // RNT-102 — stored so Google reviews can be surfaced on the listing later;
  // fetching/display needs a Google Places API key, not wired up yet.
  @ApiPropertyOptional()
  @IsOptional()
  @undefinedIfBlank
  @IsString()
  @MaxLength(200)
  googlePlaceId?: string;
}
