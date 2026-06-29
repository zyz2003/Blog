import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { linkCategories } from './link-category.schema';

export const links = sqliteTable('links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  rssUrl: text('rss_url'),
  logo: text('logo'),
  description: text('description'),
  status: text('status').notNull().default('PENDING'),
  siteshot: text('siteshot'),
  email: text('email'),
  type: text('type'),
  originalUrl: text('original_url'),
  updateReason: text('update_reason'),
  sortOrder: integer('sort_order').notNull().default(0),
  skipHealthCheck: integer('skip_health_check', { mode: 'boolean' })
    .notNull()
    .default(false),
  categoryId: integer('category_id')
    .notNull()
    .references(() => linkCategories.id),
});
