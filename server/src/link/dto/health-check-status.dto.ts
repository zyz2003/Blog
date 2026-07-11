/**
 * HealthCheckResult — matches Go LinkHealthCheckResponse JSON fields exactly.
 */
export class HealthCheckResult {
  total: number;
  healthy: number;
  unhealthy: number;
  unhealthy_ids: number[];
}

/**
 * HealthCheckStatusDto — matches Go HealthCheckStatus JSON fields exactly.
 */
export class HealthCheckStatusDto {
  is_running: boolean;
  start_time: string | null;
  end_time: string | null;
  result: HealthCheckResult | null;
  error: string;
}
