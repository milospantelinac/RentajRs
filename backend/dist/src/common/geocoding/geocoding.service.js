"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GeocodingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeocodingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GeocodingService = GeocodingService_1 = class GeocodingService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(GeocodingService_1.name);
    }
    async geocode(address, city) {
        const provider = this.config.get('geocoding.provider');
        try {
            if (provider === 'google' && this.config.get('geocoding.googleMapsApiKey')) {
                return await this.geocodeWithGoogle(address, city);
            }
            return await this.geocodeWithNominatim(address, city);
        }
        catch (err) {
            this.logger.warn(`Geocoding failed for "${address}, ${city}": ${err.message}`);
            return null;
        }
    }
    async geocodeWithNominatim(address, city) {
        const query = encodeURIComponent(`${address}, ${city}, Srbija`);
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Rentaj/1.0 (rentaj.rs)' } });
        if (!response.ok)
            return null;
        const results = (await response.json());
        if (!results.length)
            return null;
        return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
    }
    async geocodeWithGoogle(address, city) {
        const apiKey = this.config.get('geocoding.googleMapsApiKey');
        const query = encodeURIComponent(`${address}, ${city}, Serbia`);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const data = (await response.json());
        if (!data.results?.length)
            return null;
        const { lat, lng } = data.results[0].geometry.location;
        return { latitude: lat, longitude: lng };
    }
};
exports.GeocodingService = GeocodingService;
exports.GeocodingService = GeocodingService = GeocodingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeocodingService);
//# sourceMappingURL=geocoding.service.js.map