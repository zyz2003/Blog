import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { GeoIPService } from './geoip.service';

/**
 * WeatherController — public weather/IP-location endpoint.
 *
 * Per Go router.go line 276: GET /api/public/weather/ip-location
 * Returns IP geolocation data or default coordinates from settings.
 */
@Public()
@Controller('public/weather')
export class WeatherController {
  constructor(private readonly geoipService: GeoIPService) {}

  /**
   * GET /api/public/weather/ip-location
   * Extracts IP from request, looks up geolocation via GeoIPService.
   * Falls back to default coordinates from settings for private IPs or lookup failures.
   * Per D-144: Default coordinates from sidebar.weather.rectangle setting.
   */
  @Get('ip-location')
  async getIPLocation(@Req() req: any) {
    // Extract IP: prefer x-forwarded-for (proxy), fallback to req.ip
    const ip =
      (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
      req.ip ||
      '127.0.0.1';

    // Try GeoIP lookup
    const location = await this.geoipService.lookup(ip, req.headers.referer);

    if (location) {
      return {
        ip_location: {
          latitude: location.latitude,
          longitude: location.longitude,
          city: location.city,
          province: location.province,
          country: location.country,
        },
      };
    }

    // Fallback: default coordinates from settings per D-144
    const defaults = this.geoipService.getDefaultCoordinates();
    return {
      ip_location: {
        latitude: defaults.latitude,
        longitude: defaults.longitude,
        city: null,
        province: null,
        country: null,
      },
    };
  }
}
