import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const userGroups = sqliteTable('user_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  name: text('name').notNull(),
  description: text('description'),
  permissions: text('permissions', { mode: 'json' }).notNull(),
  maxStorage: integer('max_storage').notNull().default(0),
  speedLimit: integer('speed_limit').notNull().default(0),
  settings: text('settings', { mode: 'json' }).notNull(),
  storagePolicyIds: text('storage_policy_ids', { mode: 'json' }),
});
