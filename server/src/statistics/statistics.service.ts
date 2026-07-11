import { Injectable, Logger } from '@nestjs/common';
import { StatisticsRepository } from './statistics.repository';
import { UAParserService } from './ua-parser';
import { VisitorDedupService } from './visitor-dedup';
import { GeoIPService } from '../weather/geoip.service';
import { SettingsService } from '../settings/settings.service';
import { VisitorLogRequestDto } from './dto/visitor-log-request.dto';
import { VisitorStatisticsDto } from './dto/visitor-statistics.dto';
import { VisitorAnalyticsDto } from './dto/visitor-analytics.dto';
import { UrlStatisticsDto } from './dto/url-statistics.dto';
import { VisitorTrendDataDto } from './dto/visitor-trend-data.dto';
import { StatisticsSummaryDto } from './dto/statistics-summary.dto';
import { VisitorLogsResponseDto } from './dto/visitor-logs-response.dto';
import * as crypto from 'crypto';

/**
 * China timezone helpers matching Go utils.NowInChina/StartOfDayInChina/EndOfDayInChina.
 */
function nowInChina(): Date {
  const utcNow = new Date();
  const chinaOffset = 8 * 60 * 60 * 1000;
  return new Date(utcNow.getTime() + chinaOffset);
}

function startOfDayInChina(date: Date): Date {
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  const dateStr = chinaTime.toISOString().slice(0, 10);
  return new Date(`${dateStr}T00:00:00+08:00`);
}

function endOfDayInChina(date: Date): Date {
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  const dateStr = chinaTime.toISOString().slice(0, 10);
  return new Date(`${dateStr}T23:59:59+08:00`);
}

function formatDateChina(date: Date): string {
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  return chinaTime.toISOString().slice(0, 10);
}

/**
 * StatisticsService — core business logic for visitor statistics.
 * Matches Go pkg/service/statistics/visitor_stat_service.go exactly.
 *
 * Per D-160: recordVisit fires async processing and returns immediately.
 * Per D-164: full RecordVisit pipeline (IP extraction, dedup, UA parse, GeoIP, async DB writes).
 */
@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly repo: StatisticsRepository,
    private readonly uaParserService: UAParserService,
    private readonly visitorDedupService: VisitorDedupService,
    private readonly geoipService: GeoIPService,
    private readonly settingsService: SettingsService,
  ) {}

  // ============================================================
  // RECORDVISIT — matches Go RecordVisit per D-160, D-164
  // ============================================================

  /**
   * Record a visitor visit. Returns immediately (void) while async
   * processing continues in the background per D-160.
   *
   * Pipeline per D-164:
   * 1. Extract client IP from request headers
   * 2. Get User-Agent from request header
   * 3. Generate visitorID = MD5(IP + UserAgent)
   * 4. Request dedup check (3s window)
   * 5. Fire async processing (do NOT await)
   * 6. Return immediately
   */
  async recordVisit(dto: VisitorLogRequestDto, request: any): Promise<void> {
    // 1. Extract client IP matching Go getClientIP logic
    const ip = this.getClientIP(request);

    // 2. Get User-Agent
    const userAgent = request.headers?.['user-agent'] || '';

    // 3. Generate visitorID = MD5(IP + UserAgent) matching Go generateVisitorID
    const visitorID = crypto
      .createHash('md5')
      .update(ip + userAgent)
      .digest('hex');

    // 4. Request dedup check per D-164
    if (this.visitorDedupService.isDuplicateRequest(visitorID, dto.url_path)) {
      return; // Duplicate request, skip silently
    }

    // 5. Fire async processing (do NOT await) per D-160
    const referer = request.headers?.['referer'] || '';
    this.processVisitAsync(dto, ip, userAgent, visitorID, referer);

    // 6. Return immediately
  }

  /**
   * Async processing of a visit. Fire-and-forget per D-160.
   * Entire block wrapped in try-catch, errors logged but never thrown.
   */
  private processVisitAsync(
    dto: VisitorLogRequestDto,
    ip: string,
    userAgent: string,
    visitorID: string,
    referer: string,
  ): void {
    // Fire-and-forget: do NOT await
    (async () => {
      try {
        // a. Get today's date string in China timezone
        const today = nowInChina();
        const todayDateStr = formatDateChina(today);

        // b. UV dedup check
        const isUnique = this.visitorDedupService.isUniqueVisitor(ip, todayDateStr);

        // c. PV dedup check
        const isUniquePageView = this.visitorDedupService.isUniquePageView(
          ip,
          dto.url_path,
          todayDateStr,
        );

        // d. Parse UA
        const { browser, os, device } = this.uaParserService.parse(userAgent);

        // e. GeoIP lookup
        const refererValue = dto.referer || referer || '';
        let country: string | null = null;
        let region: string | null = null;
        let city: string | null = null;

        try {
          const location = await this.geoipService.lookup(ip, refererValue);
          if (location) {
            country = location.country || null;
            region = location.province || null;
            city = location.city || null;
          }
        } catch {
          this.logger.warn(`GeoIP lookup failed for IP: ${ip}`);
        }

        // f. Compute isBounce: duration < 10 (matches Go: Duration < 10)
        const isBounce = dto.duration < 10;

        // g. Create visitor_logs record
        await this.repo.createLog({
          visitorId: visitorID,
          ipAddress: ip,
          userAgent: userAgent || null,
          referer: dto.referer || null,
          urlPath: dto.url_path,
          country,
          region,
          city,
          browser,
          os,
          device,
          duration: dto.duration,
          isBounce,
        });

        // h. Update visitor_stats per D-166
        const todayStart = startOfDayInChina(today);
        await this.repo.upsertVisitorStats(todayStart, isUnique, isBounce);

        // i. Update url_stats per D-166
        await this.repo.incrementUrlStats(
          dto.url_path,
          isUniquePageView,
          dto.duration,
          isBounce,
        );
      } catch (error) {
        // Never throw — fire-and-forget per D-160
        this.logger.warn(`Async visit processing failed: ${error}`);
      }
    })();
  }

  // ============================================================
  // GETBASICSTATISTICS — matches Go GetBasicStatistics per D-168
  // ============================================================

  /**
   * Get basic visitor statistics (today/yesterday/month/year).
   * Per D-168 and Go enrichTodayYesterdayFromVisitorLogs:
   * today/yesterday are enriched from visitor_logs for accuracy.
   */
  async getBasicStatistics(): Promise<VisitorStatisticsDto> {
    const now = nowInChina();
    const today = startOfDayInChina(now);
    const yesterday = startOfDayInChina(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Month start: 1st of current month
    const monthStart = new Date(today);
    monthStart.setDate(1);

    // Year start: Jan 1 of current year
    const yearStart = new Date(today);
    yearStart.setMonth(0);
    yearStart.setDate(1);

    // Query visitor_stats for yesterday row
    const yesterdayStats = await this.repo.getVisitorStatsByDate(yesterday);

    // Query visitor_stats for month range
    const monthStats = await this.repo.getVisitorStatsByDateRange(monthStart, today);
    let monthViews = 0;
    for (const row of monthStats) {
      monthViews += row.totalViews;
    }

    // Query visitor_stats for year range
    const yearStats = await this.repo.getVisitorStatsByDateRange(yearStart, today);
    let yearViews = 0;
    for (const row of yearStats) {
      yearViews += row.totalViews;
    }

    // Enrich today/yesterday from visitor_logs per Go enrichTodayYesterdayFromVisitorLogs
    const todayViews = await this.repo.countTotalViews(today);
    const todayVisitors = await this.repo.countUniqueVisitors(today);
    const yesterdayViews = await this.repo.countTotalViews(yesterday);
    const yesterdayVisitors = await this.repo.countUniqueVisitors(yesterday);

    const dto = new VisitorStatisticsDto();
    dto.today_visitors = todayVisitors;
    dto.today_views = todayViews;
    dto.yesterday_visitors = yesterdayVisitors;
    dto.yesterday_views = yesterdayViews;
    dto.month_views = monthViews;
    dto.year_views = yearViews;

    return dto;
  }

  // ============================================================
  // GETVISITORANALYTICS — matches Go GetVisitorAnalytics per D-167, D-168
  // ============================================================

  /**
   * Get visitor analytics by dimension (browser/os/device/city/country/referer).
   * Default: last 7 days (China timezone, inclusive of today).
   */
  async getVisitorAnalytics(startDate?: string, endDate?: string): Promise<VisitorAnalyticsDto> {
    const now = nowInChina();
    const endDay = endOfDayInChina(now);
    const startDay = startOfDayInChina(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

    const parsedStart = startDate
      ? startOfDayInChina(new Date(`${startDate}T00:00:00+08:00`))
      : startDay;
    const parsedEnd = endDate
      ? endOfDayInChina(new Date(`${endDate}T23:59:59+08:00`))
      : endDay;

    const raw = await this.repo.getVisitorAnalytics(parsedStart, parsedEnd);

    const dto = new VisitorAnalyticsDto();
    dto.top_browsers = raw.top_browsers.map((b: any) => ({
      browser: b.name,
      count: b.count,
    }));
    dto.top_os = raw.top_os.map((o: any) => ({
      os: o.name,
      count: o.count,
    }));
    dto.top_devices = raw.top_devices.map((d: any) => ({
      device: d.name,
      count: d.count,
    }));
    dto.top_cities = raw.top_cities.map((c: any) => ({
      city: c.name,
      count: c.count,
    }));
    dto.top_countries = raw.top_countries.map((c: any) => ({
      country: c.name,
      count: c.count,
    }));
    dto.top_referers = raw.top_referers.map((r: any) => ({
      referer: r.name,
      count: r.count,
    }));

    return dto;
  }

  // ============================================================
  // GETTOPPAGES — matches Go GetTopPages
  // ============================================================

  /**
   * Get top pages by total views.
   * Clamp limit to [1, 100], default 10.
   */
  async getTopPages(limit?: number): Promise<UrlStatisticsDto[]> {
    let clampedLimit = limit ?? 10;
    if (clampedLimit < 1) clampedLimit = 1;
    if (clampedLimit > 100) clampedLimit = 100;

    const rows = await this.repo.getTopPages(clampedLimit);

    return rows.map((row: any) => {
      const dto = new UrlStatisticsDto();
      dto.url_path = row.urlPath;
      dto.page_title = row.pageTitle ?? null;
      dto.total_views = row.totalViews;
      dto.unique_views = row.uniqueViews;
      dto.bounce_count = row.bounceCount;
      dto.bounce_rate =
        row.totalViews > 0
          ? parseFloat(((row.bounceCount / row.totalViews) * 100).toFixed(1))
          : 0;
      dto.avg_duration = row.avgDuration;
      dto.last_visited_at = row.lastVisitedAt
        ? new Date(row.lastVisitedAt).toISOString()
        : null;
      return dto;
    });
  }

  // ============================================================
  // GETVISITORTREND — matches Go GetVisitorTrend per D-168
  // ============================================================

  /**
   * Get visitor trend data. Only daily data is returned;
   * weekly/monthly are always empty arrays per Go backend.
   * Clamp days to [1, 365], default 30.
   */
  async getVisitorTrend(period?: string, days?: number): Promise<VisitorTrendDataDto> {
    let clampedDays = days ?? 30;
    if (clampedDays < 1) clampedDays = 1;
    if (clampedDays > 365) clampedDays = 365;

    const now = nowInChina();
    const endDay = startOfDayInChina(now);
    const startDay = startOfDayInChina(
      new Date(now.getTime() - (clampedDays - 1) * 24 * 60 * 60 * 1000),
    );

    const daily: Array<{ date: string; visitors: number; views: number }> = [];

    // Iterate day-by-day from startDay to endDay
    const current = new Date(startDay);
    while (current <= endDay) {
      const views = await this.repo.countTotalViews(current);
      const visitors = await this.repo.countUniqueVisitors(current);

      daily.push({
        date: current.toISOString(),
        visitors,
        views,
      });

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    const dto = new VisitorTrendDataDto();
    dto.daily = daily;
    dto.weekly = [];
    dto.monthly = [];

    return dto;
  }

  // ============================================================
  // GETSTATISTICSSUMMARY — matches Go GetStatisticsSummary
  // ============================================================

  /**
   * Get aggregated statistics summary.
   * basic_stats + top_pages(10) + analytics(7d) + trend_data(30d daily).
   */
  async getStatisticsSummary(): Promise<StatisticsSummaryDto> {
    const basic_stats = await this.getBasicStatistics();
    const top_pages = await this.getTopPages(10);
    const analytics = await this.getVisitorAnalytics();
    const trend_data = await this.getVisitorTrend('daily', 30);

    const dto = new StatisticsSummaryDto();
    dto.basic_stats = basic_stats;
    dto.top_pages = top_pages;
    dto.analytics = analytics;
    dto.trend_data = trend_data;

    return dto;
  }

  // ============================================================
  // GETVISITORLOGS — matches Go GetVisitorLogs
  // ============================================================

  /**
   * Get paginated visitor log entries.
   * Default: last 7 days, page 1, page_size 20.
   * Returns simplified DTO with: user_agent, ip_address, city, url_path, duration, created_at.
   */
  async getVisitorLogs(
    startDate?: string,
    endDate?: string,
    page?: number,
    pageSize?: number,
  ): Promise<VisitorLogsResponseDto> {
    const now = nowInChina();
    const defaultEnd = endOfDayInChina(now);
    const defaultStart = startOfDayInChina(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    );

    const parsedStart = startDate
      ? startOfDayInChina(new Date(`${startDate}T00:00:00+08:00`))
      : defaultStart;
    const parsedEnd = endDate
      ? endOfDayInChina(new Date(`${endDate}T23:59:59+08:00`))
      : defaultEnd;

    let clampedPage = page ?? 1;
    if (clampedPage < 1) clampedPage = 1;

    let clampedPageSize = pageSize ?? 20;
    if (clampedPageSize < 1) clampedPageSize = 1;
    if (clampedPageSize > 200) clampedPageSize = 200;

    const { list, total } = await this.repo.getVisitorLogsByTimeRange(
      parsedStart,
      parsedEnd,
      clampedPage,
      clampedPageSize,
    );

    const dto = new VisitorLogsResponseDto();
    dto.list = list.map((log: any) => ({
      user_agent: log.userAgent || '',
      ip_address: log.ipAddress || '',
      city: log.city || '',
      url_path: log.urlPath || '',
      duration: log.duration ?? 0,
      created_at: log.createdAt
        ? new Date(log.createdAt).toISOString()
        : '',
    }));
    dto.total = total;
    dto.page = clampedPage;
    dto.page_size = clampedPageSize;

    return dto;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Extract client IP from request headers matching Go getClientIP logic.
   * Priority: X-Forwarded-For (first IP) -> X-Real-IP -> X-Original-Forwarded-For -> request.ip
   */
  private getClientIP(request: any): string {
    const xForwardedFor = request.headers?.['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = String(xForwardedFor).split(',');
      if (ips.length > 0) {
        return ips[0].trim();
      }
    }

    const xRealIP = request.headers?.['x-real-ip'];
    if (xRealIP) {
      return String(xRealIP).trim();
    }

    const xOriginalForwardedFor = request.headers?.['x-original-forwarded-for'];
    if (xOriginalForwardedFor) {
      return String(xOriginalForwardedFor).trim();
    }

    return request.ip || '';
  }
}
