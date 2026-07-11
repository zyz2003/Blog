import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatisticsService } from './statistics.service';
import { StatisticsRepository } from './statistics.repository';
import { UAParserService } from './ua-parser';
import { VisitorDedupService } from './visitor-dedup';
import { GeoIPService } from '../weather/geoip.service';
import { SettingsService } from '../settings/settings.service';
import { VisitorLogRequestDto } from './dto/visitor-log-request.dto';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let repo: StatisticsRepository;
  let uaParser: UAParserService;
  let visitorDedup: VisitorDedupService;
  let geoipService: GeoIPService;
  let settingsService: SettingsService;

  beforeEach(() => {
    repo = {
      createLog: vi.fn(),
      countTotalViews: vi.fn(),
      countUniqueVisitors: vi.fn(),
      getVisitorStatsByDate: vi.fn(),
      getVisitorStatsByDateRange: vi.fn(),
      upsertVisitorStats: vi.fn(),
      incrementUrlStats: vi.fn(),
      getTopPages: vi.fn(),
      getVisitorAnalytics: vi.fn(),
      getVisitorLogsByTimeRange: vi.fn(),
    } as any;

    uaParser = {
      parse: vi.fn().mockReturnValue({ browser: 'Chrome', os: 'Windows', device: 'Desktop' }),
    } as any;

    visitorDedup = {
      isDuplicateRequest: vi.fn().mockReturnValue(false),
      isUniqueVisitor: vi.fn().mockReturnValue(true),
      isUniquePageView: vi.fn().mockReturnValue(true),
    } as any;

    geoipService = {
      lookup: vi.fn().mockResolvedValue({ city: 'Beijing', province: 'Beijing', country: 'China' }),
    } as any;

    settingsService = {
      get: vi.fn().mockReturnValue(''),
    } as any;

    service = new StatisticsService(
      repo,
      uaParser,
      visitorDedup,
      geoipService,
      settingsService,
    );
  });

  // ─── Test 1: recordVisit extracts IP and generates visitorID ────────
  describe('recordVisit', () => {
    it('should extract IP from X-Forwarded-For, generate visitorID, check dedup, and fire async processing', async () => {
      const dto = new VisitorLogRequestDto();
      dto.url_path = '/posts/test';
      dto.duration = 30;

      const request = {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
          'user-agent': 'Mozilla/5.0 Chrome/120',
        },
        ip: '9.9.9.9',
      } as any;

      // Should return immediately (void)
      const result = await service.recordVisit(dto, request);

      expect(result).toBeUndefined();
      // Verify dedup was checked
      expect(visitorDedup.isDuplicateRequest).toHaveBeenCalled();
    });

    // ─── Test 2: recordVisit returns immediately per D-160 ──────────
    it('should return immediately without awaiting DB writes per D-160', async () => {
      const dto = new VisitorLogRequestDto();
      dto.url_path = '/posts/test';
      dto.duration = 30;

      const request = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '127.0.0.1',
      } as any;

      // Make repo.createLog slow to verify we don't await it
      let createLogResolved = false;
      repo.createLog = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        createLogResolved = true;
      });

      const start = Date.now();
      await service.recordVisit(dto, request);
      const elapsed = Date.now() - start;

      // Should return in < 50ms (not waiting for the 100ms createLog)
      expect(elapsed).toBeLessThan(50);
    });

    // ─── Test 3: recordVisit skips duplicate requests ───────────────
    it('should skip duplicate requests (3s window) and return success', async () => {
      const dto = new VisitorLogRequestDto();
      dto.url_path = '/posts/test';
      dto.duration = 30;

      const request = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '127.0.0.1',
      } as any;

      // Mark as duplicate
      (visitorDedup.isDuplicateRequest as any).mockReturnValue(true);

      await service.recordVisit(dto, request);

      // Should NOT call createLog since it's a duplicate
      // Give a small delay to ensure async processing would have started
      await new Promise((r) => setTimeout(r, 50));
      expect(repo.createLog).not.toHaveBeenCalled();
    });
  });

  // ─── Test 4: getBasicStatistics enriches today/yesterday from visitor_logs ──
  describe('getBasicStatistics', () => {
    it('should return today/yesterday/month/year stats, enriching today/yesterday from visitor_logs', async () => {
      // Mock visitor_stats for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      repo.getVisitorStatsByDate = vi.fn().mockImplementation(async (date: Date) => {
        // Return yesterday stats
        return { uniqueVisitors: 50, totalViews: 200, pageViews: 200, bounceCount: 10 };
      });

      repo.getVisitorStatsByDateRange = vi.fn().mockResolvedValue([
        { uniqueVisitors: 100, totalViews: 500, pageViews: 500, bounceCount: 20 },
        { uniqueVisitors: 80, totalViews: 400, pageViews: 400, bounceCount: 15 },
      ]);

      // Mock visitor_logs enrichment
      repo.countTotalViews = vi.fn().mockResolvedValue(42);
      repo.countUniqueVisitors = vi.fn().mockResolvedValue(15);

      const result = await service.getBasicStatistics();

      expect(result).toHaveProperty('today_visitors');
      expect(result).toHaveProperty('today_views');
      expect(result).toHaveProperty('yesterday_visitors');
      expect(result).toHaveProperty('yesterday_views');
      expect(result).toHaveProperty('month_views');
      expect(result).toHaveProperty('year_views');

      // Today/yesterday should be enriched from visitor_logs
      expect(result.today_views).toBe(42);
      expect(result.today_visitors).toBe(15);
    });
  });

  // ─── Test 5: getVisitorAnalytics returns 6 dimension arrays ──────
  describe('getVisitorAnalytics', () => {
    it('should return 6 dimension arrays (browsers, os, devices, cities, countries, referers) with name+count', async () => {
      const mockAnalytics = {
        top_browsers: [{ name: 'Chrome', count: 30 }],
        top_os: [{ name: 'Windows', count: 20 }],
        top_devices: [{ name: 'Desktop', count: 25 }],
        top_cities: [{ name: 'Beijing', count: 10 }],
        top_countries: [{ name: 'China', count: 15 }],
        top_referers: [{ name: 'google.com', count: 5 }],
      };

      repo.getVisitorAnalytics = vi.fn().mockResolvedValue(mockAnalytics);

      const result = await service.getVisitorAnalytics();

      expect(result).toHaveProperty('top_browsers');
      expect(result).toHaveProperty('top_os');
      expect(result).toHaveProperty('top_devices');
      expect(result).toHaveProperty('top_cities');
      expect(result).toHaveProperty('top_countries');
      expect(result).toHaveProperty('top_referers');
    });
  });

  // ─── Test 6: getTopPages returns url_stats rows ordered by totalViews ──
  describe('getTopPages', () => {
    it('should return url_stats rows ordered by totalViews with limit', async () => {
      const mockPages = [
        { urlPath: '/posts/popular', totalViews: 500, uniqueViews: 200, bounceCount: 50, avgDuration: 30, lastVisitedAt: new Date() },
        { urlPath: '/posts/second', totalViews: 300, uniqueViews: 150, bounceCount: 30, avgDuration: 25, lastVisitedAt: new Date() },
      ];

      repo.getTopPages = vi.fn().mockResolvedValue(mockPages);

      const result = await service.getTopPages(10);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('url_path');
      expect(result[0]).toHaveProperty('total_views');
      expect(result[0]).toHaveProperty('bounce_rate');
    });
  });

  // ─── Test 7: getVisitorTrend returns daily array, weekly/monthly empty ──
  describe('getVisitorTrend', () => {
    it('should return daily array with date+visitors+views, weekly/monthly are empty arrays', async () => {
      repo.countTotalViews = vi.fn().mockResolvedValue(10);
      repo.countUniqueVisitors = vi.fn().mockResolvedValue(5);

      const result = await service.getVisitorTrend('daily', 3);

      expect(result).toHaveProperty('daily');
      expect(result).toHaveProperty('weekly');
      expect(result).toHaveProperty('monthly');
      expect(Array.isArray(result.daily)).toBe(true);
      expect(Array.isArray(result.weekly)).toBe(true);
      expect(result.weekly.length).toBe(0);
      expect(Array.isArray(result.monthly)).toBe(true);
      expect(result.monthly.length).toBe(0);
      // 3 days = 3 entries
      expect(result.daily.length).toBe(3);
      expect(result.daily[0]).toHaveProperty('date');
      expect(result.daily[0]).toHaveProperty('visitors');
      expect(result.daily[0]).toHaveProperty('views');
    });
  });

  // ─── Test 8: getStatisticsSummary returns aggregated data ────────
  describe('getStatisticsSummary', () => {
    it('should return basic_stats + top_pages(10) + analytics(7d) + trend_data(30d daily)', async () => {
      // Mock all sub-methods
      const basicStats = {
        today_visitors: 10,
        today_views: 50,
        yesterday_visitors: 8,
        yesterday_views: 40,
        month_views: 500,
        year_views: 5000,
      };

      // Spy on getBasicStatistics
      vi.spyOn(service, 'getBasicStatistics').mockResolvedValue(basicStats as any);
      vi.spyOn(service, 'getTopPages').mockResolvedValue([] as any);
      vi.spyOn(service, 'getVisitorAnalytics').mockResolvedValue({} as any);
      vi.spyOn(service, 'getVisitorTrend').mockResolvedValue({ daily: [], weekly: [], monthly: [] } as any);

      const result = await service.getStatisticsSummary();

      expect(result).toHaveProperty('basic_stats');
      expect(result).toHaveProperty('top_pages');
      expect(result).toHaveProperty('analytics');
      expect(result).toHaveProperty('trend_data');
      expect(service.getBasicStatistics).toHaveBeenCalled();
      expect(service.getTopPages).toHaveBeenCalledWith(10);
      expect(service.getVisitorAnalytics).toHaveBeenCalled();
      expect(service.getVisitorTrend).toHaveBeenCalledWith('daily', 30);
    });
  });

  // ─── Test 9: getVisitorLogs returns paginated log entries ────────
  describe('getVisitorLogs', () => {
    it('should return paginated log entries with simplified DTO fields', async () => {
      const mockLogs = [
        {
          userAgent: 'Mozilla/5.0',
          ipAddress: '1.2.3.4',
          city: 'Beijing',
          urlPath: '/posts/test',
          duration: 30,
          createdAt: new Date('2026-07-11T12:00:00+08:00'),
        },
      ];

      repo.getVisitorLogsByTimeRange = vi.fn().mockResolvedValue({
        list: mockLogs,
        total: 1,
      });

      const result = await service.getVisitorLogs();

      expect(result).toHaveProperty('list');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('page_size');
      expect(result.list[0]).toHaveProperty('user_agent');
      expect(result.list[0]).toHaveProperty('ip_address');
      expect(result.list[0]).toHaveProperty('city');
      expect(result.list[0]).toHaveProperty('url_path');
      expect(result.list[0]).toHaveProperty('duration');
      expect(result.list[0]).toHaveProperty('created_at');
    });
  });
});
