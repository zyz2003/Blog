import { VisitorStatisticsDto } from './visitor-statistics.dto';
import { UrlStatisticsDto } from './url-statistics.dto';
import { VisitorAnalyticsDto } from './visitor-analytics.dto';
import { VisitorTrendDataDto } from './visitor-trend-data.dto';

/**
 * StatisticsSummaryDto — matches Go StatisticsSummary struct exactly.
 * GET /statistics/summary
 * Summary uses: basic stats + top 10 pages + last 7 days analytics + last 30 days daily trend.
 */
export class StatisticsSummaryDto {
  basic_stats: VisitorStatisticsDto = new VisitorStatisticsDto();
  top_pages: UrlStatisticsDto[] = [];
  analytics: VisitorAnalyticsDto = new VisitorAnalyticsDto();
  trend_data: VisitorTrendDataDto = new VisitorTrendDataDto();
}
