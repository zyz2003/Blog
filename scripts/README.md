# Migration Scripts

Data migration tools for transitioning from the Go backend (PostgreSQL/SQLite with ISO8601 timestamps) to the NestJS backend (SQLite with Unix epoch timestamps).

## Quick Start

```bash
# From the server/ directory:
npm run migrate -- --source /path/to/go-backend.db --target /path/to/nestjs-backend.db

# Dry run (no backup, no verification, verbose output):
npm run migrate:dry-run -- --source /path/to/go.db --target /path/to/nest.db
```

## CLI Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--source <path>` | Yes | — | Source Go backend SQLite database path |
| `--target <path>` | Yes | — | Target NestJS backend SQLite database path |
| `--skip-backup` | No | false | Skip automatic backup of target database |
| `--skip-verify` | No | false | Skip post-migration verification |
| `--verbose` | No | false | Enable verbose logging with row samples |
| `--help` | No | — | Show usage information |

## Migration Flow

1. Parse CLI arguments and validate file paths
2. Open source DB (read-only) and target DB (read-write)
3. Create backup of target DB (unless `--skip-backup`)
4. Disable foreign key checks on target (`PRAGMA foreign_keys=OFF`)
5. For each table in migration order:
   - Read all rows from source table
   - Convert timestamp columns from ISO8601 to Unix epoch
   - Clear target table (`DELETE FROM`)
   - Insert rows into target (`INSERT OR REPLACE`) in batches of 100
   - Log progress
6. Re-enable foreign key checks (`PRAGMA foreign_keys=ON`)
7. Run post-migration verification (unless `--skip-verify`)
8. Close both databases

## Table Migration Order

Tables are migrated in topological order based on foreign key dependencies:

| Layer | Tables |
|-------|--------|
| 0 (standalone) | user_groups, settings, storage_policies, album_categories, post_categories, post_tags, tags, pages, subscribers, url_stats, visitor_logs, visitor_stats, notification_types, link_categories, link_tags, doc_series, entities |
| 1 (depends on Layer 0) | users, albums, links |
| 2 (depends on Layer 0+1) | articles, files, comments, user_installed_themes, user_notification_configs |
| 3 (depends on Layer 2) | article_histories, direct_links, file_entities, metadata |
| 4 (junction/pivot) | article_post_categories, article_post_tags, link_tag_pivot, notifications |

## Timestamp Conversion

The Go backend stores timestamps as ISO8601/RFC3339 text strings:
```
"2025-07-13T23:40:12Z"
"2025-07-13T23:40:12+08:00"
```

The NestJS backend stores timestamps as Unix epoch integer seconds:
```
1752450012
```

The migration automatically converts timestamp columns per table. See `migrate-config.ts` for the complete column mapping.

### Timestamp columns per table (beyond common created_at/updated_at/deleted_at)

| Table | Additional Timestamp Columns |
|-------|------------------------------|
| users | last_login_at |
| articles | scheduled_at, reviewed_at, takedown_at |
| albums | published_at |
| comments | pinned_at |
| url_stats | last_visited_at |
| visitor_stats | date |
| user_installed_themes | install_time |

## Post-Migration Verification

After migration, the tool verifies:

1. **Row count parity** — Each table in source must have the same row count in target
2. **Critical value spot-check** — `id_seed` and `JWT_SECRET` must match exactly
3. **FK integrity** — `PRAGMA foreign_key_check` on target must return no violations

### Verification output example

```
── Post-migration verification ──
  ✅ user_groups: 3 rows (source: 3)
  ✅ settings: 45 rows (source: 45)
  ✅ id_seed: matches
  ✅ JWT_SECRET: matches
  ❌ articles: 120 rows (source: 125) — MISMATCH
  ✅ FK integrity: no violations
```

## Error Handling

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | Migration error (backup restored if available) |
| 2 | Verification failed (data not restored — may be partially correct) |

If the migration fails mid-way, the tool automatically restores the target database from the backup.

## Self-Referencing Tables

Tables with foreign keys to themselves (`comments.parent_id`, `files.parent_id`) are handled by disabling FK checks during the entire migration. This allows single-pass insertion without ordering constraints. FK integrity is verified in the post-migration check.

## Edge Cases

| Case | Behavior |
|------|----------|
| Source table not found | Skip with warning |
| Target table not found (source has it) | Skip, logged as warning |
| Empty source table | Skip with info log |
| NULL timestamp value | Converted to NULL (not 0) |
| Already-integer timestamp | Passed through unchanged |
| Invalid timestamp string | Warning logged, NULL returned |
| NestJS-only table (notifications) | Skipped in source read |

## Files

| File | Purpose |
|------|---------|
| `migrate.ts` | Main migration CLI script |
| `migrate-config.ts` | Table order, timestamp columns, critical settings |
| `migrate-utils.ts` | Timestamp conversion, backup/restore, progress formatting |
| `test-convert.ts` | Unit tests for timestamp conversion |

## Troubleshooting

**"Cannot find module 'better-sqlite3'"**
Run the script from the `server/` directory, or use `npm run migrate` which runs from the correct context.

**"Source file does not exist"**
Verify the path to the Go backend's SQLite database. The Go backend stores its database at the path configured in its config file.

**"Target directory does not exist"**
The target directory must exist before running migration. Create it if needed.

**Verification shows row count mismatch**
Check if the target database already has data. The migration clears each target table before inserting, so pre-existing data is replaced.

**FK integrity violations after migration**
This indicates referential integrity issues in the source data. Review the specific violations and fix the source data if needed.
