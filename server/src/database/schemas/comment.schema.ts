import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const comments = sqliteTable(
  'comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    targetPath: text('target_path').notNull(),
    targetTitle: text('target_title'),
    userId: integer('user_id'),
    parentId: integer('parent_id'),
    replyToId: integer('reply_to_id'),
    nickname: text('nickname').notNull(),
    email: text('email'),
    emailMd5: text('email_md5').notNull(),
    website: text('website'),
    content: text('content').notNull(),
    contentHtml: text('content_html').notNull(),
    status: integer('status').notNull().default(2),
    isAdminComment: integer('is_admin_comment', { mode: 'boolean' })
      .notNull()
      .default(false),
    isAnonymous: integer('is_anonymous', { mode: 'boolean' })
      .notNull()
      .default(false),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address').notNull(),
    ipLocation: text('ip_location'),
    likeCount: integer('like_count').notNull().default(0),
    pinnedAt: integer('pinned_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('idx_comments_target_status').on(table.targetPath, table.status),
    index('idx_comments_parent_id').on(table.parentId),
    index('idx_comments_user_id').on(table.userId),
    index('idx_comments_email').on(table.email),
  ],
);
