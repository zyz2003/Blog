/**
 * VisitorLogsResponseDto — matches Go handler inline VisitorLogDTO exactly.
 * GET /statistics/visitor-logs
 * List items have: user_agent, ip_address, city, url_path, duration, created_at.
 */
export class VisitorLogsResponseDto {
  list: Array<{
    user_agent: string;
    ip_address: string;
    city: string;
    url_path: string;
    duration: number;
    created_at: string;
  }> = [];
  total: number = 0;
  page: number = 1;
  page_size: number = 20;
}
