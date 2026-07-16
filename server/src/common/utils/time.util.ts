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

/**
 * Get current time in China timezone context.
 * Matches Go utils.NowInChina() — returns the same moment, viewed in China timezone.
 *
 * IMPORTANT: JavaScript Date objects are always UTC internally. This function
 * returns the current moment (same as new Date()), but the returned Date should
 * be used with startOfDayInChina(), endOfDayInChina(), or formatToChinaTime()
 * to get China-local values. Do NOT add offset to the Date object itself.
 */
export function getChinaNow(): Date {
  return new Date();
}

/**
 * Get start of yesterday in China timezone.
 * Matches Go utils.StartOfDayInChina(now).AddDate(0, 0, -1).
 */
export function getChinaYesterday(): Date {
  // Get today's date in China timezone, then subtract one day
  const now = new Date();
  const zoned = toZonedTime(now, 'Asia/Shanghai');
  const chinaDateStr = format(zoned, 'yyyy-MM-dd', { timeZone: 'Asia/Shanghai' });
  // Parse yesterday in China timezone
  const [y, m, d] = chinaDateStr.split('-').map(Number);
  const yesterdayChina = new Date(y, m - 1, d - 1); // local date for yesterday in China
  return startOfDayInChina(yesterdayChina);
}

/**
 * Get start of day in China timezone (00:00:00+08:00).
 * Matches Go utils.StartOfDayInChina(date).
 */
export function startOfDayInChina(date: Date): Date {
  const zoned = toZonedTime(date, 'Asia/Shanghai');
  const dateStr = format(zoned, 'yyyy-MM-dd', { timeZone: 'Asia/Shanghai' });
  return new Date(`${dateStr}T00:00:00+08:00`);
}

/**
 * Get end of day in China timezone (23:59:59+08:00).
 * Matches Go utils.EndOfDayInChina(date).
 */
export function endOfDayInChina(date: Date): Date {
  const zoned = toZonedTime(date, 'Asia/Shanghai');
  const dateStr = format(zoned, 'yyyy-MM-dd', { timeZone: 'Asia/Shanghai' });
  return new Date(`${dateStr}T23:59:59+08:00`);
}

/**
 * Get China timezone (UTC+8) day boundaries as Unix timestamps.
 * Matches Go backend: start of day = 00:00:00+08:00, end of day = 23:59:59+08:00.
 * Returns [startTimestamp, endTimestamp] in seconds.
 */
export function getChinaDayBounds(date: Date): [number, number] {
  const start = startOfDayInChina(date);
  const end = endOfDayInChina(date);
  return [Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000)];
}

/**
 * Format a date as YYYY-MM-DD in China timezone.
 */
export function formatDateChina(date: Date): string {
  const zoned = toZonedTime(date, 'Asia/Shanghai');
  return format(zoned, 'yyyy-MM-dd', { timeZone: 'Asia/Shanghai' });
}
