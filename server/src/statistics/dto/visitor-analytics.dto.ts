/**
 * VisitorAnalyticsDto — matches Go VisitorAnalytics struct exactly.
 * GET /statistics/analytics
 * 6 dimension arrays matching Go VisitorAnalytics.
 */
export class VisitorAnalyticsDto {
  top_countries: Array<{ country: string; count: number }> = [];
  top_cities: Array<{ city: string; count: number }> = [];
  top_browsers: Array<{ browser: string; count: number }> = [];
  top_os: Array<{ os: string; count: number }> = [];
  top_devices: Array<{ device: string; count: number }> = [];
  top_referers: Array<{ referer: string; count: number }> = [];
}
