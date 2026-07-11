import { IsOptional, IsString } from 'class-validator';

/**
 * AnalyticsQueryDto — matches Go GetVisitorAnalytics query params.
 * GET /statistics/analytics
 * Default: last 7 days China timezone.
 */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  start_date?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  end_date?: string; // YYYY-MM-DD
}
