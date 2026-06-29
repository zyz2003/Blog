import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const notificationTypes = sqliteTable(
  'notification_types',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    isActive: integer('is_active', { mode: 'boolean' })
      .notNull()
      .default(true),
    defaultEnabled: integer('default_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    supportedChannels: text('supported_channels', { mode: 'json' }),
  },
  (table) => [
    index('idx_notification_types_category').on(table.category),
  ],
);
