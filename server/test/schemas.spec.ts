import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Schema Definitions Verification', () => {
  const dbPath = join(process.cwd(), 'data', 'anheyu.db');

  it('should have 30 application tables in the database', () => {
    if (!existsSync(dbPath)) {
      throw new Error('Database not found. Run drizzle-kit push first.');
    }

    const db = new Database(dbPath);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name",
      )
      .all() as { name: string }[];
    db.close();

    expect(tables.length).toBe(30);

    const tableNames = tables.map((t) => t.name);
    // Verify all expected tables exist
    const expectedTables = [
      'users',
      'user_groups',
      'settings',
      'articles',
      'article_histories',
      'post_categories',
      'post_tags',
      'pages',
      'files',
      'file_entities',
      'entities',
      'metadatas',
      'direct_links',
      'storage_policies',
      'comments',
      'links',
      'link_categories',
      'link_tags',
      'link_tag_pivot',
      'albums',
      'album_categories',
      'doc_series',
      'notification_types',
      'user_notification_configs',
      'user_installed_themes',
      'subscribers',
      'visitor_logs',
      'visitor_stats',
      'url_stats',
      'tags',
    ];

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it('should have id column as primary key on all tables', () => {
    if (!existsSync(dbPath)) {
      throw new Error('Database not found. Run drizzle-kit push first.');
    }

    const db = new Database(dbPath);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'",
      )
      .all() as { name: string }[];

    for (const table of tables) {
      const columns = db.pragma(`table_info('${table.name}')`) as {
        name: string;
        pk: number;
      }[];
      const idColumn = columns.find((c) => c.name === 'id');
      expect(idColumn, `Table ${table.name} should have an 'id' column`).toBeDefined();
      expect(idColumn!.pk, `Table ${table.name} id column should be primary key`).toBe(1);
    }

    db.close();
  });

  it('should have deletedAt column on tables with soft delete', () => {
    if (!existsSync(dbPath)) {
      throw new Error('Database not found. Run drizzle-kit push first.');
    }

    const db = new Database(dbPath);

    // Tables that use SoftDeleteMixin in Go (verified to have deleted_at)
    const softDeleteTables = [
      'users',
      'user_groups',
      'settings',
      'articles',
      'post_categories',
      'post_tags',
      'pages',
      'files',
      'file_entities',
      'metadatas',
      'direct_links',
      'storage_policies',
      'comments',
      'links',
      'albums',
      'user_installed_themes',
      'tags',
    ];

    for (const tableName of softDeleteTables) {
      const columns = db.pragma(`table_info('${tableName}')`) as {
        name: string;
      }[];
      const hasDeletedAt = columns.some((c) => c.name === 'deleted_at');
      expect(
        hasDeletedAt,
        `Table ${tableName} should have 'deleted_at' column (uses SoftDeleteMixin)`,
      ).toBe(true);
    }

    db.close();
  });
});
