import { Controller, Get, Query } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

/**
 * RNT-026 — R40 still holds (the owner never has to type coordinates), but
 * the owner asked repeatedly for a map with a pin so a guest can judge
 * distance before booking. This backs that: geocode the address as soon as
 * it's typed so the wizard can show a pin the owner can drag to fine-tune,
 * rather than trusting free-text geocoding blindly.
 */
@Controller('geocoding')
export class GeocodingController {
  constructor(private geocoding: GeocodingService) {}

  @Get('preview')
  preview(@Query('address') address: string, @Query('city') city: string) {
    if (!address || !city) return null;
    return this.geocoding.geocode(address, city);
  }
}
