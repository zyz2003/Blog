import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { GeoIPService } from './geoip.service';
import { SettingsService } from '../settings/settings.service';

/**
 * WeatherController — public weather/IP-location endpoint.
 *
 * Per Go router.go line 276: GET /api/public/weather/ip-location
 * Returns flat IP location data matching Go IPLocationResponse structure.
 */
@Public()
@Controller('public/weather')
export class WeatherController {
  constructor(
    private readonly geoipService: GeoIPService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * GET /api/public/weather/ip-location
   * Extracts IP from request, looks up geolocation via GeoIPService.
   * Falls back to default coordinates from settings for private IPs or lookup failures.
   * Per D-144: Default coordinates from sidebar.weather.rectangle setting.
   * Per Go handler.go GetIPLocation: returns flat IPLocationResponse + default_rectangle for LAN.
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
        ip,
        country: location.country || '',
        province: location.province || '',
        city: location.city || '',
        isp: location.isp || '',
        latitude: location.latitude ? String(location.latitude) : '',
        longitude: location.longitude ? String(location.longitude) : '',
        address: [location.country, location.province, location.city].filter(Boolean).join('') || '',
      };
    }

    // Fallback: default coordinates from settings per D-144
    // Match Go: returns default_rectangle alongside location for LAN/private IPs
    const defaults = this.geoipService.getDefaultCoordinates();
    const rectangle = this.settingsService.get('sidebar.weather.rectangle') || '';
    const result: any = {
      ip,
      country: '局域网',
      province: '局域网',
      city: '',
      isp: '',
      latitude: defaults.latitude ? String(defaults.latitude) : '',
      longitude: defaults.longitude ? String(defaults.longitude) : '',
      address: '',
    };
    if (rectangle) {
      result.default_rectangle = rectangle;
    }
    return result;
  }
}
