import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/**
 * GeoIPService - IP 地理位置查询,基于腾讯位置服务 IP 定位。
 *
 * 接口:https://apis.map.qq.com/ws/location/v1/ip
 * 认证:sidebar.weather.ip_api_key(腾讯位置服务个人开发者 key,免费 6000 次/天)
 * 响应:result.location.lat/lng + result.ad_info.nation/province/city/district
 *
 * 私有/回环 IP(本地开发 ::1、127.0.0.1、192.168.* 等)不传 ip 参数,
 * 由腾讯用「请求端公网 IP」(即服务器公网 IP)定位--本地开发也能定位到
 * 开发者的公网 IP 归属地,而非直接 fallback 到默认坐标。
 *
 * 成功结果缓存 5 分钟。Exported from WeatherModule for CommentModule consumption.
 */
@Injectable()
export class GeoIPService {
  private readonly logger = new Logger(GeoIPService.name);

  /** Cache: cacheKey -> { location, expiresAt } */
  private cache = new Map<string, { location: any; expiresAt: number }>();

  /** Cache TTL: 5 minutes */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  /** 腾讯位置服务 IP 定位接口 */
  private readonly QQ_IP_API = 'https://apis.map.qq.com/ws/location/v1/ip';

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 通过腾讯 IP 定位查询地理位置。
   * 返回结构化位置对象或 null(未配置 key / 查询失败)。
   * 私有/回环 IP 不传 ip 参数,改用请求端公网 IP 定位(本地开发定位到开发者公网 IP)。
   */
  async lookup(ip: string, referer?: string): Promise<any | null> {
    const key = this.settingsService.get('sidebar.weather.ip_api_key');
    if (!key) {
      this.logger.warn('sidebar.weather.ip_api_key 未配置,IP 定位不可用');
      return null;
    }

    // 私有/回环 IP:不传 ip,让腾讯用请求端公网 IP(本地开发定位到开发者公网 IP)
    const isPrivate = this.isPrivateIP(ip);
    const cacheKey = isPrivate ? '__private__' : ip;

    // 命中缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.location;
    }

    try {
      const url = isPrivate
        ? `${this.QQ_IP_API}?key=${encodeURIComponent(key)}`
        : `${this.QQ_IP_API}?key=${encodeURIComponent(key)}&ip=${encodeURIComponent(ip)}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        this.logger.warn(`腾讯 IP 定位返回 ${response.status}`);
        return null;
      }

      const data = (await response.json()) as any;
      if (data.status !== 0 || !data.result) {
        this.logger.warn(`腾讯 IP 定位失败: status=${data.status} ${data.message || ''}`);
        return null;
      }

      const loc = data.result.location || {};
      const ad = data.result.ad_info || {};
      const location = {
        latitude: loc.lat ?? null,
        longitude: loc.lng ?? null,
        city: ad.city || ad.district || '',
        province: ad.province || '',
        country: ad.nation || '',
        isp: data.result.isp || '',
      };

      this.cache.set(cacheKey, {
        location,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      return location;
    } catch (error) {
      this.logger.warn(`腾讯 IP 定位异常: ${error}`);
      return null;
    }
  }

  /**
   * Check if IP is in private/LAN ranges.
   * Private ranges: 10.*, 172.16-31.*, 192.168.*, 127.*, ::1
   */
  isPrivateIP(ip: string): boolean {
    if (!ip) return true;

    // Handle IPv4-mapped IPv6 addresses (::ffff:10.0.0.1)
    const normalized = ip.replace(/^::ffff:/, '');

    // Loopback (IPv4 + IPv6)
    if (normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1') return true;

    const parts = normalized.split('.');
    if (parts.length !== 4) return true; // Non-IPv4(含 IPv6 回环)视为私有

    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);

    // 10.0.0.0/8
    if (first === 10) return true;

    // 172.16.0.0/12
    if (first === 172 && second >= 16 && second <= 31) return true;

    // 192.168.0.0/16
    if (first === 192 && second === 168) return true;

    return false;
  }

  /**
   * Get default coordinates from settings sidebar.weather.rectangle.
   * Per D-144: Returns default coordinates when IP is private or lookup fails.
   * Rectangle format: "longitude,latitude" (e.g., "116.407526,39.90403")
   */
  getDefaultCoordinates(): { latitude: number | null; longitude: number | null } {
    const rectangle = this.settingsService.get('sidebar.weather.rectangle') || '';
    if (!rectangle) {
      return { latitude: null, longitude: null };
    }

    // Parse "longitude,latitude" format
    const parts = rectangle.split(',');
    if (parts.length >= 2) {
      const longitude = parseFloat(parts[0].trim());
      const latitude = parseFloat(parts[1].trim());
      if (!isNaN(longitude) && !isNaN(latitude)) {
        return { latitude, longitude };
      }
    }

    return { latitude: null, longitude: null };
  }
}
