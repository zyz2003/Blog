import { sqliteTable, integer, real, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const urlStats = sqliteTable(
  'url_stats',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    urlPath: text('url_path').notNull(),
    pageTitle: text('page_title'),
    totalViews: integer('total_views').notNull().default(0),
    uniqueViews: integer('unique_views').notNull().default(0),
    bounceCount: integer('bounce_count').notNull().default(0),
    avgDuration: real('avg_duration').notNull().default(0),
    lastVisitedAt: integer('last_visited_at', { mode: 'timestamp' }),
  },
  (table) => [
    uniqueIndex('idx_url_stats_url_path').on(table.urlPath),
    index('idx_url_stats_total_views').on(table.totalViews),
    index('idx_url_stats_last_visited').on(table.lastVisitedAt),
  ],
);
