import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: StatisticsService;

  beforeEach(() => {
    service = {
      recordVisit: vi.fn().mockResolvedValue(undefined),
      getBasicStatistics: vi.fn().mockResolvedValue({
        today_visitors: 10,
        today_views: 50,
        yesterday_visitors: 8,
        yesterday_views: 40,
        month_views: 500,
        year_views: 5000,
      }),
      getVisitorAnalytics: vi.fn().mockResolvedValue({
        top_browsers: [],
        top_os: [],
        top_devices: [],
        top_cities: [],
        top_countries: [],
        top_referers: [],
      }),
      getTopPages: vi.fn().mockResolvedValue([]),
      getVisitorTrend: vi.fn().mockResolvedValue({
        daily: [],
        weekly: [],
        monthly: [],
      }),
      getStatisticsSummary: vi.fn().mockResolvedValue({
        basic_stats: {},
        top_pages: [],
        analytics: {},
        trend_data: {},
      }),
      getVisitorLogs: vi.fn().mockResolvedValue({
        list: [],
        total: 0,
        page: 1,
        page_size: 20,
      }),
    } as any;

    controller = new StatisticsController(service);
  });

  // ─── Test 1: getBasicStatistics (public) ────────────────────────
  describe('getBasicStatistics', () => {
    it('should call service.getBasicStatistics and return result', async () => {
      const result = await controller.getBasicStatistics();

      expect(service.getBasicStatistics).toHaveBeenCalled();
      expect(result).toHaveProperty('today_visitors');
      expect(result).toHaveProperty('today_views');
    });
  });

  // ─── Test 2: recordVisit (public) ──────────────────────────────
  describe('recordVisit', () => {
    it('should call service.recordVisit and return null per D-160', async () => {
      const dto = { url_path: '/test', duration: 30 };
      const request = { headers: { 'user-agent': 'test' } };

      const result = await controller.recordVisit(dto as any, request);

      expect(service.recordVisit).toHaveBeenCalledWith(dto, request);
      expect(result).toBeNull();
    });
  });

  // ─── Test 3: getVisitorAnalytics (admin) ────────────────────────
  describe('getVisitorAnalytics', () => {
    it('should call service.getVisitorAnalytics with query params', async () => {
      const query = { start_date: '2026-07-04', end_date: '2026-07-11' };

      const result = await controller.getVisitorAnalytics(query as any);

      expect(service.getVisitorAnalytics).toHaveBeenCalledWith(
        '2026-07-04',
        '2026-07-11',
      );
      expect(result).toHaveProperty('top_browsers');
    });

    it('should call service.getVisitorAnalytics without query params (defaults)', async () => {
      const query = {};

      await controller.getVisitorAnalytics(query as any);

      expect(service.getVisitorAnalytics).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  // ─── Test 4: getTopPages (admin) ────────────────────────────────
  describe('getTopPages', () => {
    it('should call service.getTopPages with limit from query', async () => {
      const query = { limit: 5 };

      await controller.getTopPages(query as any);

      expect(service.getTopPages).toHaveBeenCalledWith(5);
    });

    it('should call service.getTopPages with default limit', async () => {
      const query = { limit: 10 };

      await controller.getTopPages(query as any);

      expect(service.getTopPages).toHaveBeenCalledWith(10);
    });
  });

  // ─── Test 5: getVisitorTrend (admin) ────────────────────────────
  describe('getVisitorTrend', () => {
    it('should call service.getVisitorTrend with period and days', async () => {
      const query = { period: 'daily', days: 7 };

      await controller.getVisitorTrend(query as any);

      expect(service.getVisitorTrend).toHaveBeenCalledWith('daily', 7);
    });
  });

  // ─── Test 6: getStatisticsSummary (admin) ───────────────────────
  describe('getStatisticsSummary', () => {
    it('should call service.getStatisticsSummary', async () => {
      const result = await controller.getStatisticsSummary();

      expect(service.getStatisticsSummary).toHaveBeenCalled();
      expect(result).toHaveProperty('basic_stats');
      expect(result).toHaveProperty('top_pages');
      expect(result).toHaveProperty('analytics');
      expect(result).toHaveProperty('trend_data');
    });
  });

  // ─── Test 7: getVisitorLogs (admin) ─────────────────────────────
  describe('getVisitorLogs', () => {
    it('should call service.getVisitorLogs with query params', async () => {
      const query = {
        start_date: '2026-07-04',
        end_date: '2026-07-11',
        page: 2,
        page_size: 50,
      };

      await controller.getVisitorLogs(query as any);

      expect(service.getVisitorLogs).toHaveBeenCalledWith(
        '2026-07-04',
        '2026-07-11',
        2,
        50,
      );
    });

    it('should call service.getVisitorLogs with default params', async () => {
      const query = {};

      await controller.getVisitorLogs(query as any);

      expect(service.getVisitorLogs).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });
});
