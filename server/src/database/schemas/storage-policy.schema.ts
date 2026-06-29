import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const storagePolicies = sqliteTable('storage_policies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  flag: text('flag').unique(),
  server: text('server'),
  bucketName: text('bucket_name'),
  isPrivate: integer('is_private', { mode: 'boolean' }),
  accessKey: text('access_key'),
  secretKey: text('secret_key'),
  maxSize: integer('max_size'),
  basePath: text('base_path'),
  virtualPath: text('virtual_path'),
  settings: text('settings', { mode: 'json' }),
  nodeId: integer('node_id'),
});
