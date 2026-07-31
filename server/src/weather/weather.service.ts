import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/**
 * WeatherService - 和风天气代理服务。
 *
 * 取代前端直连和风天气 API：前端不再持有 qweather_key，改为调用后端
 * GET /api/public/weather/now，由本服务用私有 key 请求和风并合并返回。
 * 这样 qweather_key / qweather_api_host 永不离开后端，访客侧零 key 暴露。
 *
 * - 城市查询：https://${qweather_api_host}/v2/city/lookup（开发者专属 API Host，公共 geoapi 自 2026 起停用）
 * - 天气查询：https://${qweather_api_host}/v7/weather/now
 * - 同 location 结果缓存 5 分钟，降低和风 QPS 消耗。
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  /** Cache: location -> { data, expiresAt } */
  private readonly cache = new Map<string, { data: WeatherResult; expiresAt: number }>();

  /** Cache TTL: 5 minutes */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 按坐标查询天气 + 城市名。
   * location 格式：经度,纬度（如 112.65,27.97）。
   * key 未配置或请求失败时返回 { city:'未知', weather:null }，不抛错——
   * 访客侧静默降级（时钟仍显示，天气区域空），管理员可查日志发现配置缺失。
   */
  async getWeather(location: string): Promise<WeatherResult> {
    // 参数校验：仅允许 数字,数字，防注入/SSRF
    if (!location || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(location)) {
      return { city: '未知', weather: null };
    }

    const key = this.settingsService.get('sidebar.weather.qweather_key');
    if (!key) {
      this.logger.warn('sidebar.weather.qweather_key 未配置，天气代理返回空');
      return { city: '未知', weather: null };
    }

    const host =
      this.settingsService.get('sidebar.weather.qweather_api_host') ||
      'devapi.qweather.com';

    // 命中缓存
    const cached = this.cache.get(location);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const [city, weather] = await Promise.all([
      this.fetchCityName(location, key, host),
      this.fetchWeatherNow(location, key, host),
    ]);

    const data: WeatherResult = { city, weather };
    this.cache.set(location, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return data;
  }

  /** 调和风 city lookup 拿城市名，失败返回 '未知'（用开发者专属 API Host） */
  private async fetchCityName(location: string, key: string, host: string): Promise<string> {
    try {
      const url = `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(location)}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        this.logger.warn(`和风城市查询返回 ${res.status}`);
        return '未知';
      }
      const data = (await res.json()) as any;
      if (data.code === '200' && Array.isArray(data.location) && data.location.length > 0) {
        return data.location[0].name || '未知';
      }
      return '未知';
    } catch (error) {
      this.logger.warn(`和风城市查询失败: ${error}`);
      return '未知';
    }
  }

  /** 调和风 weather now 拿实时天气，失败返回 null */
  private async fetchWeatherNow(location: string, key: string, host: string): Promise<any | null> {
    try {
      const url = `https://${host}/v7/weather/now?location=${encodeURIComponent(location)}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        this.logger.warn(`和风天气查询返回 ${res.status}`);
        return null;
      }
      const data = (await res.json()) as any;
      if (data.code === '200' && data.now) {
        return data.now;
      }
      return null;
    } catch (error) {
      this.logger.warn(`和风天气查询失败: ${error}`);
      return null;
    }
  }
}

export interface WeatherResult {
  city: string;
  weather: any | null;
}
