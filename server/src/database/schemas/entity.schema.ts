import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const entities = sqliteTable('entities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  type: text('type').notNull(),
  source: text('source'),
  size: integer('size').notNull(),
  uploadSessionId: text('upload_session_id'),
  recycleOptions: text('recycle_options', { mode: 'json' }),
  policyId: integer('policy_id').notNull(),
  createdBy: integer('created_by'),
  etag: text('etag'),
  mimeType: text('mime_type'),
  dimension: text('dimension'),
  storageMetadata: text('storage_metadata', { mode: 'json' }),
});
