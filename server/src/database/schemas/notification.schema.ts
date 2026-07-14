import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './user.schema';
import { notificationTypes } from './notification-type.schema';

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    notificationTypeId: integer('notification_type_id')
      .notNull()
      .references(() => notificationTypes.id),
    title: text('title').notNull(),
    content: text('content'),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    readAt: integer('read_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('idx_notifications_user_id').on(table.userId),
    index('idx_notifications_user_unread').on(table.userId, table.isRead),
    index('idx_notifications_type_id').on(table.notificationTypeId),
  ],
);
