import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * TrendQueryDto — matches Go GetVisitorTrend query params.
 * GET /statistics/trend
 * Note: Go backend currently only returns daily data regardless of period param.
 */
export class TrendQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly'])
  period: string = 'daily';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  days: number = 30;
}
