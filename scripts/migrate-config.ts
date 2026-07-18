/**
 * Migration configuration for Go backend → NestJS backend data migration.
 *
 * Defines table migration order (FK dependency topological sort),
 * timestamp columns per table that need ISO8601→Unix epoch conversion,
 * and critical settings keys to verify post-migration.
 */

// ─── Table migration order (FK dependency topological sort) ─────────────────
// Layer 0: No FK dependencies (standalone or self-referencing only)
// Layer 1: Depends on Layer 0 tables
// Layer 2: Depends on Layer 0 + Layer 1 tables
// Layer 3: Depends on Layer 2 tables
// Layer 4: Junction/pivot tables

export const MIGRATION_ORDER: string[] = [
  // Layer 0 — standalone tables
  'user_groups',
  'settings',
  'storage_policies',
  'album_categories',
  'post_categories',
  'post_tags',
  'tags',
  'pages',
  'subscribers',
  'url_stats',
  'visitor_logs',
  'visitor_stats',
  'notification_types',
  'link_categories',
  'link_tags',
  'doc_series',
  'entities',

  // Layer 1 — depends on Layer 0
  'users',       // → user_groups
  'albums',      // → album_categories
  'links',       // → link_categories

  // Layer 2 — depends on Layer 0 + Layer 1
  'articles',                  // → users, doc_series
  'files',                     // → users, entities, self (parent_id)
  'comments',                  // → users, articles, self (parent_id)
  'user_installed_themes',     // → users
  'user_notification_configs', // → users, notification_types

  // Layer 3 — depends on Layer 2
  'article_histories',  // → articles
  'direct_links',       // → files
  'file_entities',      // → files, entities
  'metadata',           // → files

  // Layer 4 — junction/pivot tables
  'article_post_categories',  // → articles, post_categories
  'article_post_tags',        // → articles, post_tags
  'link_tag_pivot',           // → links, link_tags
  'notifications',            // → users, notification_types (NestJS-only table)
];

// ─── Timestamp columns per table ────────────────────────────────────────────
// Go Ent stores timestamps as ISO8601/RFC3339 text in SQLite.
// NestJS stores them as Unix epoch integer seconds.
// These columns need conversion during migration.

export const TIMESTAMP_COLUMNS: Record<string, string[]> = {
  // Common timestamp columns (most tables)
  user_groups:                  ['created_at', 'updated_at', 'deleted_at'],
  settings:                     ['created_at', 'updated_at', 'deleted_at'],
  storage_policies:             ['created_at', 'updated_at', 'deleted_at'],
  album_categories:             [],  // no timestamps in Go schema
  post_categories:              ['created_at', 'updated_at', 'deleted_at'],
  post_tags:                    ['created_at', 'updated_at', 'deleted_at'],
  tags:                         ['created_at', 'updated_at', 'deleted_at'],
  pages:                        ['created_at', 'updated_at', 'deleted_at'],
  subscribers:                  ['created_at', 'updated_at'],
  url_stats:                    ['created_at', 'updated_at', 'last_visited_at'],
  visitor_logs:                 ['created_at'],
  visitor_stats:                ['created_at', 'updated_at', 'date'],
  notification_types:           ['created_at', 'updated_at'],
  link_categories:              [],  // no timestamps in Go schema
  link_tags:                    [],  // no timestamps in Go schema
  doc_series:                   ['created_at', 'updated_at'],
  entities:                     ['created_at', 'updated_at'],

  // Layer 1
  users:                        ['created_at', 'updated_at', 'deleted_at', 'last_login_at'],
  albums:                       ['created_at', 'updated_at', 'deleted_at', 'published_at'],
  links:                        [],  // no timestamps in Go schema

  // Layer 2
  articles:                     ['created_at', 'updated_at', 'deleted_at', 'scheduled_at', 'reviewed_at', 'takedown_at'],
  files:                        ['created_at', 'updated_at', 'deleted_at'],
  comments:                     ['created_at', 'updated_at', 'deleted_at', 'pinned_at'],
  user_installed_themes:        ['created_at', 'updated_at', 'deleted_at', 'install_time'],
  user_notification_configs:    ['created_at', 'updated_at'],

  // Layer 3
  article_histories:            ['created_at'],
  direct_links:                 ['created_at', 'updated_at', 'deleted_at'],
  file_entities:                ['created_at', 'updated_at', 'deleted_at'],
  metadata:                     ['created_at', 'updated_at', 'deleted_at'],

  // Layer 4
  article_post_categories:      [],  // no timestamps
  article_post_tags:            [],  // no timestamps
  link_tag_pivot:               [],  // no timestamps in Go schema
  notifications:                ['created_at', 'read_at'],  // NestJS-only
};

// ─── Critical settings keys to verify post-migration ────────────────────────
// These must be exact string matches between source and target.

export const CRITICAL_SETTINGS_KEYS: string[] = [
  'id_seed',
  'JWT_SECRET',
];

// ─── Self-referencing tables ────────────────────────────────────────────────
// Tables with FK to themselves — handled by disabling FK checks during migration.

export const SELF_REFERENCING_TABLES: string[] = [
  'comments',  // parent_id → comments.id
  'files',     // parent_id → files.id
];

// ─── Table name mapping: Go → NestJS ────────────────────────────────────────
// When the Go backend and NestJS use different table names.

export const TABLE_NAME_MAP: Record<string, string> = {
  metadata: 'metadatas',  // Go: "metadata" → NestJS: "metadatas"
};

// ─── Column name mapping per table: Go → NestJS ─────────────────────────────
// When Go and NestJS use different column names for the same data.

export const COLUMN_NAME_MAP: Record<string, Record<string, string>> = {
  links: {
    link_category_links: 'category_id',  // Go: "link_category_links" → NestJS: "category_id"
  },
};

// ─── Columns to exclude from source (Go columns not in NestJS) ──────────────
// These Go columns have no equivalent in NestJS and must be dropped during migration.

export const COLUMN_EXCLUSIONS: Record<string, string[]> = {
  comments: ['article_comments'],  // Go FK column; NestJS uses target_path instead
};

// ─── Columns to add with defaults (NestJS columns not in Go source) ──────────
// When NestJS has columns that don't exist in the Go source, provide default values.

export const COLUMN_DEFAULTS: Record<string, Record<string, () => any>> = {
  link_tag_pivot: {
    // Go has composite PK (link_id, link_tag_id); NestJS has auto-increment id + created_at
    created_at: () => Math.floor(Date.now() / 1000),
  },
  // links table: Go has no timestamps, NestJS has created_at/updated_at/deleted_at
  // SQLite column defaults (unixepoch() / NULL) handle these automatically
};

// ─── NestJS-only tables (not in Go backend) ─────────────────────────────────
// These tables exist in NestJS but not in the Go backend.
// Migration should skip them in the source DB read (they won't exist).

export const NESTJS_ONLY_TABLES: string[] = [
  'notifications',
];
