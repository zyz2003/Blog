/**
 * VisitorTrendDataDto — matches Go VisitorTrendData struct exactly.
 * GET /statistics/trend
 * daily array + empty weekly/monthly arrays per Go backend.
 * Note: Go backend currently only returns daily data regardless of period param.
 */
export class VisitorTrendDataDto {
  daily: Array<{ date: string; visitors: number; views: number }> = [];
  weekly: Array<{ date: string; visitors: number; views: number }> = [];
  monthly: Array<{ date: string; visitors: number; views: number }> = [];
}
