import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const visitorStats = sqliteTable(
  'visitor_stats',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    date: integer('date', { mode: 'timestamp' }).notNull(),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),
    totalViews: integer('total_views').notNull().default(0),
    pageViews: integer('page_views').notNull().default(0),
    bounceCount: integer('bounce_count').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_visitor_stats_date').on(table.date),
  ],
);
