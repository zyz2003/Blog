import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  path: text('path').notNull().unique(),
  content: text('content'),
  markdownContent: text('markdown_content').notNull().default(''),
  customJs: text('custom_js').notNull().default(''),
  customCss: text('custom_css').notNull().default(''),
  description: text('description'),
  isPublished: integer('is_published', { mode: 'boolean' })
    .notNull()
    .default(true),
  showComment: integer('show_comment', { mode: 'boolean' })
    .notNull()
    .default(false),
  sort: integer('sort').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
