import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './user.schema';
import { notificationTypes } from './notification-type.schema';

export const userNotificationConfigs = sqliteTable(
  'user_notification_configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    notificationTypeId: integer('notification_type_id')
      .notNull()
      .references(() => notificationTypes.id),
    isEnabled: integer('is_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    enabledChannels: text('enabled_channels', { mode: 'json' }),
    notificationEmail: text('notification_email'),
    customSettings: text('custom_settings', { mode: 'json' }),
  },
  (table) => [
    uniqueIndex('idx_user_notification_user_type').on(
      table.userId,
      table.notificationTypeId,
    ),
    index('idx_user_notification_user_id').on(table.userId),
  ],
);
