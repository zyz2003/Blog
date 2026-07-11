import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatisticsRepository } from './statistics.repository';
import { visitorLogs } from '../database/schemas/visitor-log.schema';
import { visitorStats } from '../database/schemas/visitor-stat.schema';
import { urlStats } from '../database/schemas/url-stat.schema';

describe('StatisticsRepository', () => {
  let repository: StatisticsRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      run: vi.fn(),
    };
    repository = new StatisticsRepository(mockDb);
  });

  // ─── Test 1: createLog ──────────────────────────────────────────
  describe('createLog', () => {
    it('should insert a visitor_logs record and return it', async () => {
      const params = {
        visitorId: 'abc123',
        ipAddress: '127.0.0.1',
        urlPath: '/posts/test',
        duration: 30,
        isBounce: false,
      };
      const mockInserted = { id: 1, ...params, createdAt: new Date() };

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      const result = await repository.createLog(params);

      expect(mockDb.insert).toHaveBeenCalledWith(visitorLogs);
      expect(result).toEqual(mockInserted);
    });
  });

  // ─── Test 2: countTotalViews ────────────────────────────────────
  describe('countTotalViews', () => {
    it('should return count of visitor_logs rows for a date range', async () => {
      const date = new Date('2026-07-11T00:00:00+08:00');

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      });

      const result = await repository.countTotalViews(date);

      expect(result).toBe(42);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ─── Test 3: countUniqueVisitors ────────────────────────────────
  describe('countUniqueVisitors', () => {
    it('should return count of distinct visitorId for a date range', async () => {
      const date = new Date('2026-07-11T00:00:00+08:00');

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 15 }]),
        }),
      });

      const result = await repository.countUniqueVisitors(date);

      expect(result).toBe(15);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ─── Test 4: getVisitorStatsByDate ──────────────────────────────
  describe('getVisitorStatsByDate', () => {
    it('should return visitor_stats row for a specific date', async () => {
      const date = new Date('2026-07-11T00:00:00+08:00');
      const mockStat = {
        id: 1,
        date,
        uniqueVisitors: 10,
        totalViews: 50,
        pageViews: 50,
        bounceCount: 5,
      };

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockStat]),
        }),
      });

      const result = await repository.getVisitorStatsByDate(date);

      expect(result).toEqual(mockStat);
    });

    it('should return undefined when no stats found for date', async () => {
      const date = new Date('2026-07-11T00:00:00+08:00');

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.getVisitorStatsByDate(date);

      expect(result).toBeUndefined();
    });
  });

  // ─── Test 5: getVisitorStatsByDateRange ─────────────────────────
  describe('getVisitorStatsByDateRange', () => {
    it('should return visitor_stats rows for a date range', async () => {
      const startDate = new Date('2026-07-01T00:00:00+08:00');
      const endDate = new Date('2026-07-31T00:00:00+08:00');
      const mockStats = [
        { id: 1, date: startDate, uniqueVisitors: 10, totalViews: 50 },
        { id: 2, date: endDate, uniqueVisitors: 20, totalViews: 100 },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockStats),
        }),
      });

      const result = await repository.getVisitorStatsByDateRange(startDate, endDate);

      expect(result).toEqual(mockStats);
    });
  });

  // ─── Test 6: upsertVisitorStats ─────────────────────────────────
  describe('upsertVisitorStats', () => {
    it('should increment existing visitor_stats row', async () => {
      const date = new Date('2026-07-11T00:00:00+08:00');
      const existingStat = {
        id: 1,
        date,
        uniqueVisitors: 10,
        totalViews: 50,
        pageViews: 50,
        bounceCount: 5,
      };

      // First call: getVisitorStatsByDate (select)
      // Second call: update
      let selectCallCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingStat]),
          }),
        };
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await repository.upsertVisitorStats(date, true, true);

      expect(mockDb.update).toHaveBeenCalledWith(visitorStats);
    });

    it('should insert new visitor_stats row when none exists', async () => {
      const date = new Date('2026-07-11T00:00:00+08:00');

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, date }]),
        }),
      });

      await repository.upsertVisitorStats(date, true, false);

      expect(mockDb.insert).toHaveBeenCalledWith(visitorStats);
    });
  });

  // ─── Test 7: incrementUrlStats ──────────────────────────────────
  describe('incrementUrlStats', () => {
    it('should update existing url_stats row', async () => {
      const existingStat = {
        id: 1,
        urlPath: '/posts/test',
        totalViews: 100,
        uniqueViews: 50,
        bounceCount: 10,
        avgDuration: 25.5,
      };

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingStat]),
        }),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await repository.incrementUrlStats('/posts/test', true, 30, false);

      expect(mockDb.update).toHaveBeenCalledWith(urlStats);
    });

    it('should insert new url_stats row when none exists', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, urlPath: '/posts/test' }]),
        }),
      });

      await repository.incrementUrlStats('/posts/test', true, 30, false);

      expect(mockDb.insert).toHaveBeenCalledWith(urlStats);
    });
  });

  // ─── Test 8: getTopPages ────────────────────────────────────────
  describe('getTopPages', () => {
    it('should return url_stats rows ordered by totalViews DESC with limit', async () => {
      const mockPages = [
        { id: 1, urlPath: '/posts/popular', totalViews: 500 },
        { id: 2, urlPath: '/posts/second', totalViews: 300 },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockPages),
          }),
        }),
      });

      const result = await repository.getTopPages(10);

      expect(result).toEqual(mockPages);
    });
  });

  // ─── Test 9: getVisitorAnalytics ────────────────────────────────
  describe('getVisitorAnalytics', () => {
    it('should return GROUP BY results for browser/os/device/city/country/referer dimensions', async () => {
      const startDate = new Date('2026-07-04T00:00:00+08:00');
      const endDate = new Date('2026-07-11T00:00:00+08:00');

      const mockBrowsers = [{ name: 'Chrome', count: 30 }];
      const mockOs = [{ name: 'Windows', count: 20 }];
      const mockDevices = [{ name: 'Desktop', count: 25 }];
      const mockCities = [{ name: 'Beijing', count: 10 }];
      const mockCountries = [{ name: 'China', count: 15 }];
      const mockReferers = [{ name: 'google.com', count: 5 }];

      let callCount = 0;
      mockDb.all = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockBrowsers);
        if (callCount === 2) return Promise.resolve(mockOs);
        if (callCount === 3) return Promise.resolve(mockDevices);
        if (callCount === 4) return Promise.resolve(mockCities);
        if (callCount === 5) return Promise.resolve(mockCountries);
        return Promise.resolve(mockReferers);
      });

      const result = await repository.getVisitorAnalytics(startDate, endDate);

      expect(result).toEqual({
        top_browsers: mockBrowsers,
        top_os: mockOs,
        top_devices: mockDevices,
        top_cities: mockCities,
        top_countries: mockCountries,
        top_referers: mockReferers,
      });
      expect(mockDb.all).toHaveBeenCalledTimes(6);
    });
  });

  // ─── Test 10: getVisitorLogsByTimeRange ─────────────────────────
  describe('getVisitorLogsByTimeRange', () => {
    it('should return visitor_logs rows for a date range with pagination', async () => {
      const startDate = new Date('2026-07-04T00:00:00+08:00');
      const endDate = new Date('2026-07-11T00:00:00+08:00');
      const mockLogs = [
        { id: 1, visitorId: 'abc', urlPath: '/test' },
        { id: 2, visitorId: 'def', urlPath: '/other' },
      ];

      let selectCallCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Count query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 2 }]),
            }),
          };
        }
        // List query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockLogs),
                }),
              }),
            }),
          }),
        };
      });

      const result = await repository.getVisitorLogsByTimeRange(startDate, endDate, 1, 20);

      expect(result).toEqual({ list: mockLogs, total: 2 });
    });
  });
});
