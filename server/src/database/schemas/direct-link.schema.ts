import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { files } from './file.schema';

export const directLinks = sqliteTable('direct_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  fileId: integer('file_id')
    .notNull()
    .unique()
    .references(() => files.id),
  fileName: text('file_name').notNull(),
  speedLimit: integer('speed_limit').notNull().default(0),
  downloads: integer('downloads').notNull().default(0),
});
