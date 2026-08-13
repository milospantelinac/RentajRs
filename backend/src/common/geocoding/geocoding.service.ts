import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/**
 * R40: the owner types an address; coordinates are resolved automatically
 * and never shown/editable directly. Provider is swappable via
 * GEOCODING_PROVIDER — Nominatim (OpenStreetMap) needs no API key and is the
 * dev/default; a Google Maps adapter activates once GOOGLE_MAPS_API_KEY is
 * set (better accuracy for production, but paid and rate-limited).
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private config: ConfigService) {}

  async geocode(address: string, city: string): Promise<GeocodeResult | null> {
    const provider = this.config.get<string>('geocoding.provider');
    try {
      if (provider === 'google' && this.config.get('geocoding.googleMapsApiKey')) {
        return await this.geocodeWithGoogle(address, city);
      }
      return await this.geocodeWithNominatim(address, city);
    } catch (err) {
      this.logger.warn(`Geocoding failed for "${address}, ${city}": ${(err as Error).message}`);
      return null;
    }
  }

  private async geocodeWithNominatim(address: string, city: string): Promise<GeocodeResult | null> {
    const query = encodeURIComponent(`${address}, ${city}, Srbija`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Rentaj/1.0 (rentaj.rs)' } });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (!results.length) return null;
    return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
  }

  private async geocodeWithGoogle(address: string, city: string): Promise<GeocodeResult | null> {
    const apiKey = this.config.get<string>('geocoding.googleMapsApiKey');
    const query = encodeURIComponent(`${address}, ${city}, Serbia`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    if (!data.results?.length) return null;
    const { lat, lng } = data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
}
