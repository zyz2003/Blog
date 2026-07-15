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
 * Get current time adjusted to China timezone (UTC+8) context.
 * Matches Go utils.NowInChina().
 */
export function getChinaNow(): Date {
  const utcNow = new Date();
  const chinaOffset = 8 * 60 * 60 * 1000;
  return new Date(utcNow.getTime() + chinaOffset);
}

/**
 * Get start of yesterday in China timezone.
 * Matches Go utils.StartOfDayInChina(now).AddDate(0, 0, -1).
 */
export function getChinaYesterday(): Date {
  const now = getChinaNow();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return startOfDayInChina(yesterday);
}

/**
 * Get start of day in China timezone (00:00:00+08:00).
 * Matches Go utils.StartOfDayInChina(date).
 */
export function startOfDayInChina(date: Date): Date {
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  const dateStr = chinaTime.toISOString().slice(0, 10);
  return new Date(`${dateStr}T00:00:00+08:00`);
}

/**
 * Get end of day in China timezone (23:59:59+08:00).
 * Matches Go utils.EndOfDayInChina(date).
 */
export function endOfDayInChina(date: Date): Date {
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  const dateStr = chinaTime.toISOString().slice(0, 10);
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
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  return chinaTime.toISOString().slice(0, 10);
}
