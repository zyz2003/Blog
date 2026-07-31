import { Controller, Get, Req, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { GeoIPService } from './geoip.service';
import { WeatherService } from './weather.service';
import { SettingsService } from '../settings/settings.service';

/**
 * WeatherController - public weather/IP-location endpoints.
 *
 * GET /api/public/weather/ip-location - 访问者 IP 定位（经纬度+城市）。
 * GET /api/public/weather/now        - 和风天气代理（qweather_key 不下发前端）。
 */
@Public()
@Controller('public/weather')
export class WeatherController {
  constructor(
    private readonly geoipService: GeoIPService,
    private readonly settingsService: SettingsService,
    private readonly weatherService: WeatherService,
  ) {}

  /**
   * GET /api/public/weather/ip-location
   * Extracts IP from request, looks up geolocation via GeoIPService.
   * Falls back to default coordinates from settings for private IPs or lookup failures.
   * Per D-144: Default coordinates from sidebar.weather.rectangle setting.
   *
   * 返回 { code:200, data:{...}, default_rectangle? }，兼容前端期望与原 Go 格式。
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
        address:
          [location.country, location.province, location.city].filter(Boolean).join('') || '',
      };
    }

    // Fallback: default coordinates from settings per D-144
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

  /**
   * GET /api/public/weather/now?location=经度,纬度
   * 和风天气代理：用私有 qweather_key 请求和风，合并返回城市名 + 实时天气。
   * key 不下发前端，访客侧零 key 暴露。
   * 返回 { code:200, data:{ city, weather } }，weather 可能为 null（未配置/失败）。
   */
  @Get('now')
  async getWeather(@Query('location') location: string) {
    return this.weatherService.getWeather(location || '');
  }
}
