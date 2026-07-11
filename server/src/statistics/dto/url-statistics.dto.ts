/**
 * UrlStatisticsDto — matches Go URLStatistics struct exactly.
 * GET /statistics/top-pages
 * bounce_rate = bounce_count/total_views (0 if totalViews=0).
 */
export class UrlStatisticsDto {
  url_path: string = '';
  page_title: string | null = null;
  total_views: number = 0;
  unique_views: number = 0;
  bounce_count: number = 0;
  bounce_rate: number = 0;
  avg_duration: number = 0;
  last_visited_at: string | null = null;
}
