import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { StatisticsService } from './statistics.service';
import { VisitorLogRequestDto } from './dto/visitor-log-request.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { TopPagesQueryDto } from './dto/top-pages-query.dto';
import { TrendQueryDto } from './dto/trend-query.dto';
import { VisitorLogsQueryDto } from './dto/visitor-logs-query.dto';

/**
 * StatisticsController — handles all statistics endpoints.
 * Two route groups per D-169:
 *
 * Public endpoints (use @Public() decorator):
 * - GET  /api/public/statistics/basic   — basic visitor statistics
 * - POST /api/public/statistics/visit    — record visitor visit (async, returns immediately per D-160)
 *
 * Admin endpoints (protected by global JwtAuthGuard + AdminGuard):
 * - GET /api/statistics/analytics        — visitor analytics by dimension
 * - GET /api/statistics/top-pages        — top pages by views
 * - GET /api/statistics/trend            — visitor trend data
 * - GET /api/statistics/summary          — aggregated statistics summary
 * - GET /api/statistics/visitor-logs     — paginated visitor log entries
 *
 * All endpoints match Go backend paths exactly.
 * Public endpoints use @Public() to skip JWT auth.
 * Admin endpoints rely on global JwtAuthGuard (no explicit decorator needed).
 */
@Controller()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  // ============================================================
  // Public endpoints
  // ============================================================

  /**
   * GET /api/public/statistics/basic
   * Get basic visitor statistics (today/yesterday/month/year).
   * Matches Go GetBasicStatistics (router.go).
   * Returns VisitorStatisticsDto wrapped by ResponseInterceptor.
   */
  @Public()
  @Get('public/statistics/basic')
  async getBasicStatistics() {
    return this.statisticsService.getBasicStatistics();
  }

  /**
   * POST /api/public/statistics/visit
   * Record a visitor visit. Returns immediately while async processing
   * continues in the background per D-160.
   * Matches Go RecordVisit (router.go).
   */
  @Public()
  @Post('public/statistics/visit')
  async recordVisit(
    @Body() dto: VisitorLogRequestDto,
    @Req() request: any,
  ) {
    await this.statisticsService.recordVisit(dto, request);
    return null;
  }

  // ============================================================
  // Admin endpoints (protected by global JwtAuthGuard)
  // ============================================================

  /**
   * GET /api/statistics/analytics
   * Get visitor analytics by dimension (browser/os/device/city/country/referer).
   * Matches Go GetVisitorAnalytics (router.go).
   * Default: last 7 days (China timezone).
   */
  @Get('statistics/analytics')
  async getVisitorAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.statisticsService.getVisitorAnalytics(
      query.start_date,
      query.end_date,
    );
  }

  /**
   * GET /api/statistics/top-pages
   * Get top pages by total views.
   * Matches Go GetTopPages (router.go).
   * Default limit: 10, max: 100.
   */
  @Get('statistics/top-pages')
  async getTopPages(@Query() query: TopPagesQueryDto) {
    return this.statisticsService.getTopPages(query.limit);
  }

  /**
   * GET /api/statistics/trend
   * Get visitor trend data (daily only, weekly/monthly are empty arrays).
   * Matches Go GetVisitorTrend (router.go).
   * Default: 30 days daily.
   */
  @Get('statistics/trend')
  async getVisitorTrend(@Query() query: TrendQueryDto) {
    return this.statisticsService.getVisitorTrend(query.period, query.days);
  }

  /**
   * GET /api/statistics/summary
   * Get aggregated statistics summary.
   * Matches Go GetStatisticsSummary (router.go).
   * Returns basic_stats + top_pages(10) + analytics(7d) + trend_data(30d).
   */
  @Get('statistics/summary')
  async getStatisticsSummary() {
    return this.statisticsService.getStatisticsSummary();
  }

  /**
   * GET /api/statistics/visitor-logs
   * Get paginated visitor log entries.
   * Matches Go GetVisitorLogs (router.go).
   * Default: last 7 days, page 1, page_size 20.
   */
  @Get('statistics/visitor-logs')
  async getVisitorLogs(@Query() query: VisitorLogsQueryDto) {
    return this.statisticsService.getVisitorLogs(
      query.start_date,
      query.end_date,
      query.page,
      query.page_size,
    );
  }
}
