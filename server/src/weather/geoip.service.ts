import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/**
 * GeoIPService — IP geolocation lookup via NSUUU API with in-memory caching.
 *
 * Per D-143: Makes HTTP GET to https://api.nsuuu.com/api/ip-location?ip={ip}
 * Per D-144: Falls back to settings sidebar.weather.rectangle for private/LAN IPs
 * Caches successful lookups with 5-minute TTL.
 * Exported from WeatherModule for CommentModule consumption.
 */
@Injectable()
export class GeoIPService {
  private readonly logger = new Logger(GeoIPService.name);

  /** Cache: IP -> { location, expiresAt } */
  private cache = new Map<string, { location: any; expiresAt: number }>();

  /** Cache TTL: 5 minutes */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Lookup IP geolocation via NSUUU API.
   * Returns structured location object or null on failure.
   * Private/LAN IPs skip the HTTP call and return null immediately.
   *
   * Per D-143: HTTP GET to https://api.nsuuu.com/api/ip-location?ip={ip}
   */
  async lookup(ip: string, referer?: string): Promise<any | null> {
    if (!ip) return null;

    // Private/LAN IPs skip lookup
    if (this.isPrivateIP(ip)) {
      return null;
    }

    // Check cache
    const cached = this.cache.get(ip);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.location;
    }

    // Make HTTP call to NSUUU API
    try {
      const url = `https://api.nsuuu.com/api/ip-location?ip=${encodeURIComponent(ip)}`;
      const headers: Record<string, string> = {};
      if (referer) {
        headers['Referer'] = referer;
      }

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        this.logger.warn(`NSUUU API returned ${response.status} for IP: ${ip}`);
        return null;
      }

      const data = (await response.json()) as any;
      if (data.code === 200 && data.data) {
        const location = {
          latitude: data.data.latitude ?? null,
          longitude: data.data.longitude ?? null,
          city: data.data.city ?? null,
          province: data.data.province ?? null,
          country: data.data.country ?? null,
        };

        // Cache the result
        this.cache.set(ip, {
          location,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });

        return location;
      }

      return null;
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for IP ${ip}: ${error}`);
      return null;
    }
  }

  /**
   * Check if IP is in private/LAN ranges.
   * Private ranges: 10.*, 172.16-31.*, 192.168.*, 127.*
   */
  isPrivateIP(ip: string): boolean {
    if (!ip) return true;

    // Handle IPv4-mapped IPv6 addresses (::ffff:10.0.0.1)
    const normalized = ip.replace(/^::ffff:/, '');

    // Loopback
    if (normalized === '127.0.0.1' || normalized === 'localhost') return true;

    const parts = normalized.split('.');
    if (parts.length !== 4) return true; // Non-IPv4 treated as private

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
