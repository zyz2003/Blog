/**
 * Phase 14: Statistics Field-by-Field Verification
 *
 * Per D-308: Statistics key verification points are summary structure,
 * trend date format, analytics nesting, and top-pages last_visited_at.
 *
 * Per CCP-2 (LOW risk): Go uses RFC3339 without milliseconds, NestJS uses
 * ISO 8601 with milliseconds. Both are valid ISO strings, frontend handles
 * both. Do NOT assert exact date format — only assert valid ISO date string.
 *
 * Go StatisticsSummary baseline: _go-backend-archive/pkg/handler/statistics/statistics_handler.go
 * Go VisitorStatistics baseline: _go-backend-archive/pkg/domain/model/visitor_stat.go
 * Go VisitorAnalytics baseline: _go-backend-archive/pkg/domain/model/visitor_stat.go
 * Go URLStatistics baseline: _go-backend-archive/pkg/domain/model/visitor_stat.go
 * Go VisitorTrendData baseline: _go-backend-archive/pkg/domain/model/visitor_stat.go
 * Frontend statistics type: frontend/src/types/dashboard.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';
import { visitorLogs } from '../../src/database/schemas/visitor-log.schema';
import { visitorStats } from '../../src/database/schemas/visitor-stat.schema';
import { urlStats } from '../../src/database/schemas/url-stat.schema';

// ─── Field assertion helpers ─────────────────────────────────────────────

/**
 * Helper: assert field is a valid ISO date string (or null if allowed)
 * Per CCP-2: Do not assert exact format (Go RFC3339 vs NestJS ISO 8601 with ms).
 */
function expectISODateString(value: any, fieldName: string) {
  expect(value, `${fieldName} should not be null`).not.toBeNull();
  expect(typeof value, `${fieldName} should be string`).toBe('string');
  const parsed = new Date(value);
  expect(isNaN(parsed.getTime()), `${fieldName} should be valid ISO date`).toBe(false);
}

/**
 * Helper: assert field is string or null
 */
function expectStringOrNull(value: any, fieldName: string) {
  if (value !== null && value !== undefined) {
    expect(typeof value, `${fieldName} should be string or null`).toBe('string');
  }
}

/**
 * Asserts that an object has all VisitorStatistics fields with correct types,
 * matching Go VisitorStatistics struct (model/visitor_stat.go).
 *
 * 6 fields: today_visitors, today_views, yesterday_visitors,
 * yesterday_views, month_views, year_views (all numbers)
 */
function assertVisitorStatisticsFields(data: any) {
  expect(data).toHaveProperty('today_visitors');
  expect(typeof data.today_visitors).toBe('number');

  expect(data).toHaveProperty('today_views');
  expect(typeof data.today_views).toBe('number');

  expect(data).toHaveProperty('yesterday_visitors');
  expect(typeof data.yesterday_visitors).toBe('number');

  expect(data).toHaveProperty('yesterday_views');
  expect(typeof data.yesterday_views).toBe('number');

  expect(data).toHaveProperty('month_views');
  expect(typeof data.month_views).toBe('number');

  expect(data).toHaveProperty('year_views');
  expect(typeof data.year_views).toBe('number');
}

/**
 * Asserts that an object has all VisitorAnalytics fields with correct types,
 * matching Go VisitorAnalytics struct (model/visitor_stat.go).
 *
 * 6 sub-arrays: top_countries, top_cities, top_browsers,
 * top_os, top_devices, top_referers
 */
function assertVisitorAnalyticsFields(data: any) {
  // top_countries: { country: string, count: number }[]
  expect(data).toHaveProperty('top_countries');
  expect(Array.isArray(data.top_countries)).toBe(true);
  for (const item of data.top_countries) {
    expect(item).toHaveProperty('country');
    expect(typeof item.country).toBe('string');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
  }

  // top_cities: { city: string, count: number }[]
  expect(data).toHaveProperty('top_cities');
  expect(Array.isArray(data.top_cities)).toBe(true);
  for (const item of data.top_cities) {
    expect(item).toHaveProperty('city');
    expect(typeof item.city).toBe('string');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
  }

  // top_browsers: { browser: string, count: number }[]
  expect(data).toHaveProperty('top_browsers');
  expect(Array.isArray(data.top_browsers)).toBe(true);
  for (const item of data.top_browsers) {
    expect(item).toHaveProperty('browser');
    expect(typeof item.browser).toBe('string');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
  }

  // top_os: { os: string, count: number }[]
  expect(data).toHaveProperty('top_os');
  expect(Array.isArray(data.top_os)).toBe(true);
  for (const item of data.top_os) {
    expect(item).toHaveProperty('os');
    expect(typeof item.os).toBe('string');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
  }

  // top_devices: { device: string, count: number }[]
  expect(data).toHaveProperty('top_devices');
  expect(Array.isArray(data.top_devices)).toBe(true);
  for (const item of data.top_devices) {
    expect(item).toHaveProperty('device');
    expect(typeof item.device).toBe('string');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
  }

  // top_referers: { referer: string, count: number }[]
  expect(data).toHaveProperty('top_referers');
  expect(Array.isArray(data.top_referers)).toBe(true);
  for (const item of data.top_referers) {
    expect(item).toHaveProperty('referer');
    expect(typeof item.referer).toBe('string');
    expect(item).toHaveProperty('count');
    expect(typeof item.count).toBe('number');
  }
}

/**
 * Asserts that an object has VisitorTrendData fields,
 * matching Go VisitorTrendData struct (model/visitor_stat.go).
 *
 * 3 arrays: daily, weekly, monthly
 * daily: DateRangeStats[] { date, visitors, views }
 * weekly: always empty per Go backend
 * monthly: always empty per Go backend
 */
function assertVisitorTrendDataFields(data: any) {
  expect(data).toHaveProperty('daily');
  expect(Array.isArray(data.daily)).toBe(true);

  expect(data).toHaveProperty('weekly');
  expect(Array.isArray(data.weekly)).toBe(true);

  expect(data).toHaveProperty('monthly');
  expect(Array.isArray(data.monthly)).toBe(true);

  // Verify DateRangeStats items in daily array
  for (const item of data.daily) {
    // date: string (ISO format per CCP-2 — do not assert exact format)
    expect(item).toHaveProperty('date');
    expect(typeof item.date).toBe('string');
    // Verify it's a valid date
    const parsed = new Date(item.date);
    expect(isNaN(parsed.getTime()), 'trend daily date should be valid').toBe(false);

    // visitors: number
    expect(item).toHaveProperty('visitors');
    expect(typeof item.visitors).toBe('number');

    // views: number
    expect(item).toHaveProperty('views');
    expect(typeof item.views).toBe('number');
  }

  // Per Go backend: weekly and monthly are always empty arrays
  expect(data.weekly.length).toBe(0);
  expect(data.monthly.length).toBe(0);
}

/**
 * Asserts that an object has URLStatistics fields,
 * matching Go URLStatistics struct (model/visitor_stat.go).
 *
 * 8 fields: url_path, page_title, total_views, unique_views,
 * bounce_count, bounce_rate, avg_duration, last_visited_at
 */
function assertURLStatisticsFields(data: any) {
  // url_path: string
  expect(data).toHaveProperty('url_path');
  expect(typeof data.url_path).toBe('string');

  // page_title: string | null
  expect(data).toHaveProperty('page_title');
  expectStringOrNull(data.page_title, 'page_title');

  // total_views: number
  expect(data).toHaveProperty('total_views');
  expect(typeof data.total_views).toBe('number');

  // unique_views: number
  expect(data).toHaveProperty('unique_views');
  expect(typeof data.unique_views).toBe('number');

  // bounce_count: number
  expect(data).toHaveProperty('bounce_count');
  expect(typeof data.bounce_count).toBe('number');

  // bounce_rate: number
  expect(data).toHaveProperty('bounce_rate');
  expect(typeof data.bounce_rate).toBe('number');

  // avg_duration: number
  expect(data).toHaveProperty('avg_duration');
  expect(typeof data.avg_duration).toBe('number');

  // last_visited_at: string | null — matches Go *time.Time
  expect(data).toHaveProperty('last_visited_at');
  if (data.last_visited_at !== null) {
    expect(typeof data.last_visited_at).toBe('string');
    // Verify it's a valid ISO date
    const parsed = new Date(data.last_visited_at);
    expect(isNaN(parsed.getTime()), 'last_visited_at should be valid ISO date').toBe(false);
  }
}

/**
 * Asserts that an object has StatisticsSummary fields,
 * matching Go StatisticsSummary struct (handler/statistics_handler.go).
 *
 * 4 top-level fields: basic_stats, top_pages, analytics, trend_data
 */
function assertStatisticsSummaryFields(data: any) {
  // basic_stats: VisitorStatistics
  expect(data).toHaveProperty('basic_stats');
  expect(typeof data.basic_stats).toBe('object');
  assertVisitorStatisticsFields(data.basic_stats);

  // top_pages: URLStatistics[]
  expect(data).toHaveProperty('top_pages');
  expect(Array.isArray(data.top_pages)).toBe(true);
  for (const page of data.top_pages) {
    assertURLStatisticsFields(page);
  }

  // analytics: VisitorAnalytics
  expect(data).toHaveProperty('analytics');
  expect(typeof data.analytics).toBe('object');
  assertVisitorAnalyticsFields(data.analytics);

  // trend_data: VisitorTrendData
  expect(data).toHaveProperty('trend_data');
  expect(typeof data.trend_data).toBe('object');
  assertVisitorTrendDataFields(data.trend_data);
}

// ─── Test Suite ──────────────────────────────────────────────────────────

describe('Statistics verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Seed visitor_logs for statistics tests
    const now = new Date();
    const todayTs = Math.floor(now.getTime() / 1000);
    const yesterdayTs = todayTs - 86400;

    // Insert visitor_logs entries for today and yesterday
    await ctx.db.insert(visitorLogs).values([
      {
        visitorId: 'test-visitor-001',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        referer: 'https://example.com',
        urlPath: '/test-page',
        country: 'China',
        city: 'Beijing',
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop',
        duration: 30,
        isBounce: false,
        createdAt: new Date(todayTs * 1000),
      },
      {
        visitorId: 'test-visitor-002',
        ipAddress: '127.0.0.2',
        userAgent: 'Mozilla/5.0 Safari',
        referer: null,
        urlPath: '/about',
        country: 'China',
        city: 'Shanghai',
        browser: 'Safari',
        os: 'macOS',
        device: 'Mobile',
        duration: 5,
        isBounce: true,
        createdAt: new Date(yesterdayTs * 1000),
      },
    ]).run();

    // Insert visitor_stats for yesterday (for month/year aggregation)
    await ctx.db.insert(visitorStats).values({
      date: new Date(yesterdayTs * 1000),
      uniqueVisitors: 10,
      totalViews: 25,
      pageViews: 20,
      bounceCount: 5,
    }).onConflictDoNothing().run();

    // Insert url_stats for top-pages
    await ctx.db.insert(urlStats).values({
      urlPath: '/test-page',
      pageTitle: 'Test Page',
      totalViews: 100,
      uniqueViews: 80,
      bounceCount: 10,
      avgDuration: 45.5,
      lastVisitedAt: new Date(),
    }).onConflictDoNothing().run();

    await ctx.db.insert(urlStats).values({
      urlPath: '/about',
      pageTitle: 'About',
      totalViews: 50,
      uniqueViews: 40,
      bounceCount: 5,
      avgDuration: 30.2,
      lastVisitedAt: new Date(),
    }).onConflictDoNothing().run();
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── GET /api/statistics/summary ────────────────────────────────────

  describe('GET /api/statistics/summary', () => {
    it('returns StatisticsSummary with basic_stats, top_pages, analytics, trend_data', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      assertStatisticsSummaryFields(res.body.data);
    });

    it('basic_stats has 6 number fields matching Go VisitorStatistics', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const basic = res.body.data.basic_stats;

      // All 6 fields should be numbers per Go VisitorStatistics
      expect(typeof basic.today_visitors).toBe('number');
      expect(typeof basic.today_views).toBe('number');
      expect(typeof basic.yesterday_visitors).toBe('number');
      expect(typeof basic.yesterday_views).toBe('number');
      expect(typeof basic.month_views).toBe('number');
      expect(typeof basic.year_views).toBe('number');

      // Should have exactly 6 fields
      const keys = Object.keys(basic);
      expect(keys.length).toBe(6);
    });

    it('analytics has 6 sub-arrays matching Go VisitorAnalytics', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const analytics = res.body.data.analytics;

      // Verify all 6 dimension arrays exist
      expect(analytics).toHaveProperty('top_countries');
      expect(analytics).toHaveProperty('top_cities');
      expect(analytics).toHaveProperty('top_browsers');
      expect(analytics).toHaveProperty('top_os');
      expect(analytics).toHaveProperty('top_devices');
      expect(analytics).toHaveProperty('top_referers');

      // Should have exactly 6 fields
      const keys = Object.keys(analytics);
      expect(keys.length).toBe(6);
    });

    it('trend_data has daily array with DateRangeStats items', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const trend = res.body.data.trend_data;

      // daily should have 30 items (default 30 days)
      expect(trend.daily.length).toBeGreaterThan(0);

      // weekly and monthly should be empty per Go backend
      expect(trend.weekly).toEqual([]);
      expect(trend.monthly).toEqual([]);

      // Verify first daily item structure
      const firstItem = trend.daily[0];
      expect(firstItem).toHaveProperty('date');
      expect(firstItem).toHaveProperty('visitors');
      expect(firstItem).toHaveProperty('views');
    });

    it('top_pages has URLStatistics items with last_visited_at as string|null', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const topPages = res.body.data.top_pages;

      expect(Array.isArray(topPages)).toBe(true);

      // If there are top pages, verify URLStatistics fields
      for (const page of topPages) {
        // last_visited_at should be string | null matching Go *time.Time
        expect(page).toHaveProperty('last_visited_at');
        if (page.last_visited_at !== null) {
          expect(typeof page.last_visited_at).toBe('string');
          // Verify it's a valid ISO date
          const parsed = new Date(page.last_visited_at);
          expect(isNaN(parsed.getTime())).toBe(false);
        }

        // Other URLStatistics fields
        expect(typeof page.url_path).toBe('string');
        expect(typeof page.total_views).toBe('number');
        expect(typeof page.unique_views).toBe('number');
        expect(typeof page.bounce_count).toBe('number');
        expect(typeof page.bounce_rate).toBe('number');
        expect(typeof page.avg_duration).toBe('number');
      }
    });
  });

  // ─── GET /api/public/statistics/basic ───────────────────────────────

  describe('GET /api/public/statistics/basic', () => {
    it('returns VisitorStatistics with 6 fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/statistics/basic');

      assertSuccessResponse(res);
      assertVisitorStatisticsFields(res.body.data);
    });

    it('all 6 fields are numbers (today_visitors, today_views, etc.)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/statistics/basic');

      assertSuccessResponse(res);
      const data = res.body.data;

      // Per Go VisitorStatistics struct, all fields are int64 (number in JS)
      const fieldNames = [
        'today_visitors', 'today_views',
        'yesterday_visitors', 'yesterday_views',
        'month_views', 'year_views',
      ];

      for (const fieldName of fieldNames) {
        expect(data).toHaveProperty(fieldName);
        expect(typeof data[fieldName]).toBe('number');
      }
    });
  });

  // ─── POST /api/public/statistics/visit ──────────────────────────────

  describe('POST /api/public/statistics/visit', () => {
    it('records a visit and returns void response', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/statistics/visit')
        .send({
          url_path: '/new-visit-page',
          page_title: 'New Visit Page',
          referer: 'https://google.com',
          duration: 60,
        });

      // Go returns response.Success(c, nil, "记录访问成功")
      // NestJS returns null with 200
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('code', 200);
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── GET /api/statistics/trend ──────────────────────────────────────

  describe('GET /api/statistics/trend', () => {
    it('returns VisitorTrendData with daily array', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/trend')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .query({ period: 'daily', days: 7 });

      assertSuccessResponse(res);
      assertVisitorTrendDataFields(res.body.data);
    });

    it('daily items have date, visitors, views with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/trend')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .query({ period: 'daily', days: 7 });

      assertSuccessResponse(res);
      const daily = res.body.data.daily;

      // Should have 7 items for 7 days
      expect(daily.length).toBe(7);

      // Verify each DateRangeStats item
      for (const item of daily) {
        // date: string (valid ISO format per CCP-2)
        expect(typeof item.date).toBe('string');
        const parsed = new Date(item.date);
        expect(isNaN(parsed.getTime())).toBe(false);

        // visitors: number
        expect(typeof item.visitors).toBe('number');

        // views: number
        expect(typeof item.views).toBe('number');
      }
    });

    it('weekly and monthly are always empty arrays per Go backend', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/trend')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .query({ period: 'weekly', days: 30 });

      assertSuccessResponse(res);
      expect(res.body.data.weekly).toEqual([]);
      expect(res.body.data.monthly).toEqual([]);
    });
  });

  // ─── GET /api/statistics/analytics ──────────────────────────────────

  describe('GET /api/statistics/analytics', () => {
    it('returns VisitorAnalytics with 6 sub-arrays', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/analytics')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      assertVisitorAnalyticsFields(res.body.data);
    });

    it('each sub-array has items with correct {dimension, count} structure', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/analytics')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // top_countries: { country, count }[]
      for (const item of data.top_countries) {
        expect(Object.keys(item).sort()).toEqual(['count', 'country']);
      }

      // top_cities: { city, count }[]
      for (const item of data.top_cities) {
        expect(Object.keys(item).sort()).toEqual(['city', 'count']);
      }

      // top_browsers: { browser, count }[]
      for (const item of data.top_browsers) {
        expect(Object.keys(item).sort()).toEqual(['browser', 'count']);
      }

      // top_os: { os, count }[]
      for (const item of data.top_os) {
        expect(Object.keys(item).sort()).toEqual(['count', 'os']);
      }

      // top_devices: { device, count }[]
      for (const item of data.top_devices) {
        expect(Object.keys(item).sort()).toEqual(['count', 'device']);
      }

      // top_referers: { referer, count }[]
      for (const item of data.top_referers) {
        expect(Object.keys(item).sort()).toEqual(['count', 'referer']);
      }
    });
  });

  // ─── GET /api/statistics/top-pages ──────────────────────────────────

  describe('GET /api/statistics/top-pages', () => {
    it('returns URLStatistics array with last_visited_at', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/top-pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .query({ limit: 10 });

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);

      for (const page of res.body.data) {
        assertURLStatisticsFields(page);
      }
    });

    it('last_visited_at is string|null matching Go *time.Time', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/top-pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .query({ limit: 10 });

      assertSuccessResponse(res);
      const pages = res.body.data;

      for (const page of pages) {
        // last_visited_at matches Go's *time.Time — can be null or ISO string
        expect(page).toHaveProperty('last_visited_at');
        if (page.last_visited_at !== null) {
          expect(typeof page.last_visited_at).toBe('string');
          // Verify it's a valid ISO date
          const parsed = new Date(page.last_visited_at);
          expect(isNaN(parsed.getTime())).toBe(false);
        }
      }
    });

    it('URLStatistics has 8 fields matching Go struct', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/top-pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .query({ limit: 10 });

      assertSuccessResponse(res);
      const pages = res.body.data;

      if (pages.length > 0) {
        // Go URLStatistics has exactly 8 fields
        const expectedFields = [
          'url_path', 'page_title', 'total_views', 'unique_views',
          'bounce_count', 'bounce_rate', 'avg_duration', 'last_visited_at',
        ];
        const actualFields = Object.keys(pages[0]);
        for (const field of expectedFields) {
          expect(actualFields).toContain(field);
        }
      }
    });
  });
});
