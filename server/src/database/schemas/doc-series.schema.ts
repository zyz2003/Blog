import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const docSeries = sqliteTable('doc_series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  name: text('name').notNull().unique(),
  description: text('description'),
  coverUrl: text('cover_url'),
  sort: integer('sort').notNull().default(0),
  docCount: integer('doc_count').notNull().default(0),
});
