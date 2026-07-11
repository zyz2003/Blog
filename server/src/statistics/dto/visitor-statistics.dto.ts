/**
 * VisitorStatisticsDto — matches Go VisitorStatistics struct exactly.
 * GET /public/statistics/basic
 * All JSON keys use snake_case matching Go json tags.
 */
export class VisitorStatisticsDto {
  today_visitors: number = 0;
  today_views: number = 0;
  yesterday_visitors: number = 0;
  yesterday_views: number = 0;
  month_views: number = 0;
  year_views: number = 0;
}
