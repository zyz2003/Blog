import { format, toZonedTime } from 'date-fns-tz';

/**
 * Format a date to China time (UTC+8) as "YYYY-MM-DD HH:mm:ss".
 * Matches Go's utils.ToChina(time).Format("2006-01-02 15:04:05").
 * Returns null for null/undefined input.
 */
export function formatToChinaTime(
  date: Date | null | undefined,
): string | null {
  if (date == null) {
    return null;
  }

  const zoned = toZonedTime(date, 'Asia/Shanghai');
  return format(zoned, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'Asia/Shanghai' });
}

/**
 * Format a date to ISO 8601 / RFC3339 string (e.g. "2026-07-03T08:30:00.000Z").
 * Matches Go's time.Time default JSON serialization.
 * Returns null for null/undefined input.
 */
export function toISODateString(
  date: Date | null | undefined,
): string | null {
  if (date == null) {
    return null;
  }

  return date.toISOString();
}
