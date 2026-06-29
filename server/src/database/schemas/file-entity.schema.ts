import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const fileEntities = sqliteTable('file_entities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  fileId: integer('file_id').notNull(),
  entityId: integer('entity_id').notNull(),
  version: text('version'),
  isCurrent: integer('is_current', { mode: 'boolean' })
    .notNull()
    .default(true),
  uploadedByUserId: integer('uploaded_by_user_id'),
});
