import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { userGroups } from './user-group.schema';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname'),
  avatar: text('avatar'),
  email: text('email').unique(),
  website: text('website'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  status: integer('status').notNull().default(2),
  userGroupId: integer('user_group_id')
    .notNull()
    .references(() => userGroups.id),
});
