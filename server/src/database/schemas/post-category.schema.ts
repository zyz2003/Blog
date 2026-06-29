import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const postCategories = sqliteTable('post_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  name: text('name').notNull().unique(),
  slug: text('slug').unique(),
  description: text('description'),
  count: integer('count').notNull().default(0),
  isSeries: integer('is_series', { mode: 'boolean' })
    .notNull()
    .default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});
