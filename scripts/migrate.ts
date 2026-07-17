#!/usr/bin/env npx tsx
/**
 * Migration CLI: Go backend SQLite → NestJS backend SQLite
 *
 * Reads data from the Go backend's SQLite database and writes it to the
 * NestJS backend's SQLite database, preserving all data integrity including
 * id_seed and JWT_SECRET.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts --source <path> --target <path> [options]
 *
 * Options:
 *   --source <path>    Source Go SQLite .db path (required)
 *   --target <path>    Target NestJS SQLite .db path (required)
 *   --skip-backup      Skip auto-backup of target DB
 *   --skip-verify      Skip post-migration verification
 *   --verbose          Verbose logging
 *   --help             Show usage
 */

// better-sqlite3 is installed in server/node_modules, not at project root.
// Use a direct require with absolute path so tsx can find it.
import * as path from 'path';
const betterSqlite3Path = path.resolve(__dirname, '..', 'server', 'node_modules', 'better-sqlite3');
const Database = require(betterSqlite3Path) as typeof import('better-sqlite3');
import * as fs from 'fs';
import * as path from 'path';
import {
  MIGRATION_ORDER,
  TIMESTAMP_COLUMNS,
  CRITICAL_SETTINGS_KEYS,
  SELF_REFERENCING_TABLES,
  NESTJS_ONLY_TABLES,
} from './migrate-config';
import {
  convertRow,
  backupDatabase,
  restoreBackup,
  formatProgress,
} from './migrate-utils';

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

interface CliArgs {
  source: string;
  target: string;
  skipBackup: boolean;
  skipVerify: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs | null {
  const args: Partial<CliArgs> = {};

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--source':
        args.source = argv[++i];
        break;
      case '--target':
        args.target = argv[++i];
        break;
      case '--skip-backup':
        args.skipBackup = true;
        break;
      case '--skip-verify':
        args.skipVerify = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--help':
        return null;
      default:
        if (!argv[i].startsWith('--')) {
          console.error(`Unknown argument: ${argv[i]}`);
          return null;
        }
    }
  }

  if (!args.source || !args.target) {
    console.error('Error: --source and --target are required');
    return null;
  }

  return {
    source: args.source!,
    target: args.target!,
    skipBackup: args.skipBackup ?? false,
    skipVerify: args.skipVerify ?? false,
    verbose: args.verbose ?? false,
  };
}

function showUsage(): void {
  console.log(`
Migration CLI: Go backend SQLite → NestJS backend SQLite

Usage:
  npx tsx scripts/migrate.ts --source <path> --target <path> [options]

Options:
  --source <path>    Source Go SQLite .db path (required)
  --target <path>    Target NestJS SQLite .db path (required)
  --skip-backup      Skip auto-backup of target DB
  --skip-verify      Skip post-migration verification
  --verbose          Verbose logging
  --help             Show this help message

Examples:
  npx tsx scripts/migrate.ts --source ./data/go-backend.db --target ./data/nestjs-backend.db
  npx tsx scripts/migrate.ts --source ./data/go.db --target ./data/nest.db --skip-backup --verbose
`);
}

// ─── Verification ───────────────────────────────────────────────────────────

interface VerificationResult {
  passed: boolean;
  failures: string[];
}

function verifyMigration(source: Database.Database, target: Database.Database): VerificationResult {
  const failures: string[] = [];

  console.log('\n── Post-migration verification ──');

  // Get list of tables present in each DB
  const sourceTables = new Set(
    (source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map(r => r.name)
  );
  const targetTables = new Set(
    (target.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map(r => r.name)
  );

  // 1. Row count check
  for (const table of MIGRATION_ORDER) {
    // Skip NestJS-only tables — they don't exist in source
    if (NESTJS_ONLY_TABLES.includes(table)) {
      continue;
    }

    // Skip if table doesn't exist in both source and target
    if (!sourceTables.has(table)) {
      continue;  // Source doesn't have it — nothing to verify
    }
    if (!targetTables.has(table)) {
      const msg = `${table}: exists in source but missing in target`;
      console.log(`  ❌ ${msg}`);
      failures.push(msg);
      continue;
    }

    try {
      const sourceCount = source.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number };
      const targetCount = target.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number };

      if (sourceCount.count === targetCount.count) {
        console.log(`  ✅ ${table}: ${targetCount.count} rows (source: ${sourceCount.count})`);
      } else {
        const msg = `${table}: ${targetCount.count} rows (source: ${sourceCount.count}) — MISMATCH`;
        console.log(`  ❌ ${msg}`);
        failures.push(msg);
      }
    } catch (err: any) {
      const msg = `${table}: could not compare row counts — ${err.message}`;
      console.log(`  ⚠️  ${msg}`);
      failures.push(msg);
    }
  }

  // 2. Critical value spot-check
  for (const key of CRITICAL_SETTINGS_KEYS) {
    try {
      const sourceVal = source.prepare(`SELECT value FROM settings WHERE config_key = ?`).get(key) as { value: string } | undefined;
      const targetVal = target.prepare(`SELECT value FROM settings WHERE config_key = ?`).get(key) as { value: string } | undefined;

      if (!sourceVal) {
        console.log(`  ⚠️  ${key}: not found in source`);
        failures.push(`${key}: not found in source`);
        continue;
      }
      if (!targetVal) {
        console.log(`  ❌ ${key}: not found in target`);
        failures.push(`${key}: not found in target`);
        continue;
      }
      if (sourceVal.value === targetVal.value) {
        console.log(`  ✅ ${key}: matches`);
      } else {
        const msg = `${key}: MISMATCH (source=${sourceVal.value}, target=${targetVal.value})`;
        console.log(`  ❌ ${msg}`);
        failures.push(msg);
      }
    } catch (err: any) {
      const msg = `${key}: could not verify — ${err.message}`;
      console.log(`  ⚠️  ${msg}`);
      failures.push(msg);
    }
  }

  // 3. FK integrity check
  try {
    const violations = target.pragma('foreign_key_check') as any[];
    if (violations.length === 0) {
      console.log('  ✅ FK integrity: no violations');
    } else {
      const msg = `FK integrity: ${violations.length} violation(s)`;
      console.log(`  ❌ ${msg}`);
      for (const v of violations) {
        console.log(`    Table: ${v.table}, rowid: ${v.rowid}, parent: ${v.parent}, fkid: ${v.fkid}`);
      }
      failures.push(msg);
    }
  } catch (err: any) {
    console.log(`  ⚠️  FK check error: ${err.message}`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

// ─── Main Migration Flow ────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv);

  if (!args) {
    showUsage();
    process.exit(args === null && process.argv.includes('--help') ? 0 : 1);
  }

  // Validate paths
  if (!fs.existsSync(args.source)) {
    console.error(`Error: Source file does not exist: ${args.source}`);
    process.exit(1);
  }
  const targetDir = path.dirname(args.target);
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Target directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  let sourceDb: Database.Database | null = null;
  let targetDb: Database.Database | null = null;
  let backupPath: string | null = null;

  try {
    // 1. Open databases
    console.log(`[migrate] Opening source DB: ${args.source}`);
    sourceDb = new Database(args.source, { readonly: true });

    console.log(`[migrate] Opening target DB: ${args.target}`);
    targetDb = new Database(args.target);

    // 2. Backup target
    if (!args.skipBackup && fs.existsSync(args.target)) {
      backupPath = backupDatabase(args.target);
    }

    // 3. Disable FK checks on target
    targetDb.pragma('foreign_keys = OFF');

    // 4. Migrate each table
    const total = MIGRATION_ORDER.length;

    for (let i = 0; i < total; i++) {
      const tableName = MIGRATION_ORDER[i];
      const progress = formatProgress(i + 1, total, tableName);
      console.log(progress);

      // Skip NestJS-only tables — they don't exist in the source Go DB
      if (NESTJS_ONLY_TABLES.includes(tableName)) {
        console.log(`  Skipping ${tableName} — NestJS-only table (not in Go source)`);
        continue;
      }

      // Check if source table exists
      const sourceTableCheck = sourceDb.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(tableName);

      if (!sourceTableCheck) {
        console.log(`  Skipping ${tableName} — not found in source DB`);
        continue;
      }

      // Read all rows from source
      const rows = sourceDb.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, any>[];

      if (rows.length === 0) {
        console.log(`  ${tableName}: 0 rows — skipping`);
        continue;
      }

      // Get timestamp columns for this table
      const tsColumns = TIMESTAMP_COLUMNS[tableName] || [];

      // Transform rows
      const transformedRows = rows.map(row => convertRow(row, tsColumns));

      // Get column names from first row
      const columns = Object.keys(transformedRows[0]);
      const columnList = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');

      // Clear target table
      targetDb.prepare(`DELETE FROM "${tableName}"`).run();

      // Batch insert in transactions (every 100 rows)
      const insertSql = `INSERT OR REPLACE INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;
      const insertStmt = targetDb.prepare(insertSql);

      const batchSize = 100;
      const insertMany = targetDb.transaction((batch: Record<string, any>[]) => {
        for (const row of batch) {
          const values = columns.map(c => row[c]);
          insertStmt.run(...values);
        }
      });

      for (let j = 0; j < transformedRows.length; j += batchSize) {
        const batch = transformedRows.slice(j, j + batchSize);
        insertMany(batch);
      }

      console.log(`  ${tableName}: ${transformedRows.length} rows migrated`);

      if (args.verbose) {
        // Show sample of first row
        const sample = { ...transformedRows[0] };
        // Truncate long values for display
        for (const key of Object.keys(sample)) {
          if (typeof sample[key] === 'string' && sample[key].length > 80) {
            sample[key] = sample[key].substring(0, 77) + '...';
          }
        }
        console.log(`  Sample: ${JSON.stringify(sample)}`);
      }
    }

    // 5. Re-enable FK checks
    targetDb.pragma('foreign_keys = ON');
    console.log('\n[migrate] FK checks re-enabled');

    // 6. Verification
    if (!args.skipVerify) {
      const result = verifyMigration(sourceDb, targetDb);
      if (!result.passed) {
        console.error(`\n[migrate] Verification FAILED with ${result.failures.length} issue(s)`);
        process.exit(2);
      }
    }

    // 7. Close databases
    sourceDb.close();
    targetDb.close();
    sourceDb = null;
    targetDb = null;

    console.log('\n[migrate] Migration completed successfully!');

  } catch (err: any) {
    console.error(`\n[migrate] ERROR: ${err.message}`);

    // Close databases if open
    try { sourceDb?.close(); } catch {}
    try { targetDb?.close(); } catch {}

    // Restore backup if available
    if (backupPath && fs.existsSync(backupPath)) {
      console.log('[migrate] Restoring from backup...');
      restoreBackup(backupPath, args.target);
      console.log('[migrate] Backup restored.');
    }

    process.exit(1);
  }
}

main();
