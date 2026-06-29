import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const visitorLogs = sqliteTable(
  'visitor_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id'),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent'),
    referer: text('referer'),
    urlPath: text('url_path').notNull(),
    country: text('country'),
    region: text('region'),
    city: text('city'),
    browser: text('browser'),
    os: text('os'),
    device: text('device'),
    duration: integer('duration').notNull().default(0),
    isBounce: integer('is_bounce', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => [
    index('idx_visitor_logs_visitor_id').on(table.visitorId),
    index('idx_visitor_logs_session_id').on(table.sessionId),
    index('idx_visitor_logs_ip_address').on(table.ipAddress),
    index('idx_visitor_logs_url_path').on(table.urlPath),
    index('idx_visitor_logs_created_at').on(table.createdAt),
    index('idx_visitor_logs_created_visitor').on(
      table.createdAt,
      table.visitorId,
    ),
  ],
);
