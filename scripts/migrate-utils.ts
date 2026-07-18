/**
 * Migration utility functions for Go backend → NestJS backend data migration.
 *
 * Provides timestamp conversion (ISO8601/RFC3339 → Unix epoch),
 * database backup/restore, and progress formatting.
 */

import * as fs from 'fs';

/**
 * Convert Go Ent's ISO8601/RFC3339 timestamp to Unix epoch integer (seconds).
 *
 * Go Ent stores timestamps as RFC3339 text in SQLite, e.g.:
 *   "2025-07-13T23:40:12+08:00"
 *   "2025-07-13T23:40:12Z"
 *
 * NestJS stores timestamps as Unix epoch integer seconds.
 *
 * @param goTime - ISO8601/RFC3339 string, integer (already converted), null, or empty string
 * @returns Unix epoch integer (seconds) or null
 */
export function convertGoTimeToEpoch(goTime: string | number | null | undefined): number | null {
  // null or undefined → null
  if (goTime === null || goTime === undefined) {
    return null;
  }

  // Empty string → null
  if (goTime === '') {
    return null;
  }

  // Already a number — check for millisecond timestamps (Go Ent always uses RFC3339 text,
  // but if a number is present, detect millisecond values > year 2286 in seconds)
  if (typeof goTime === 'number') {
    if (goTime > 1e10) {
      return Math.floor(goTime / 1000);
    }
    return goTime;
  }

  // String: parse as ISO8601/RFC3339
  if (typeof goTime === 'string') {
    const parsed = new Date(goTime);
    if (isNaN(parsed.getTime())) {
      console.warn(`[migrate] Invalid timestamp "${goTime}" — returning null`);
      return null;
    }
    return Math.floor(parsed.getTime() / 1000);
  }

  // Fallback: unexpected type
  console.warn(`[migrate] Unexpected timestamp type ${typeof goTime}: ${goTime} — returning null`);
  return null;
}

/**
 * Transform a row by converting specified timestamp columns from ISO8601 to Unix epoch.
 * Non-timestamp columns pass through unchanged.
 *
 * @param row - Source row from Go SQLite database
 * @param timestampColumns - List of column names that need timestamp conversion
 * @returns Transformed row with converted timestamps
 */
export function convertRow(
  row: Record<string, any>,
  timestampColumns: string[],
): Record<string, any> {
  if (!timestampColumns || timestampColumns.length === 0) {
    return row;
  }

  const result = { ...row };
  for (const col of timestampColumns) {
    if (col in result) {
      result[col] = convertGoTimeToEpoch(result[col]);
    }
  }
  return result;
}

/**
 * Create a backup copy of a database file.
 *
 * @param dbPath - Path to the database file to back up
 * @returns Path to the backup file
 */
export function backupDatabase(dbPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.backup.${timestamp}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[migrate] Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Restore a database from a backup file.
 *
 * @param backupPath - Path to the backup file
 * @param targetPath - Path to restore the backup to
 */
export function restoreBackup(backupPath: string, targetPath: string): void {
  fs.copyFileSync(backupPath, targetPath);
  console.log(`[migrate] Restored from backup: ${backupPath} → ${targetPath}`);
}

/**
 * Format a progress string for migration output.
 *
 * @param current - Current table index (1-based)
 * @param total - Total number of tables
 * @param tableName - Name of the current table
 * @returns Formatted progress string like "[15/33] Migrating articles...`
 */
export function formatProgress(current: number, total: number, tableName: string): string {
  return `[${current}/${total}] Migrating ${tableName}...`;
}
