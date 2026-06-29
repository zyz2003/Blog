import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './user.schema';

export const userInstalledThemes = sqliteTable(
  'user_installed_themes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    themeName: text('theme_name').notNull(),
    themeMarketId: integer('theme_market_id'),
    isCurrent: integer('is_current', { mode: 'boolean' })
      .notNull()
      .default(false),
    installTime: integer('install_time', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    userThemeConfig: text('user_theme_config', { mode: 'json' }),
    installedVersion: text('installed_version'),
    deployType: text('deploy_type').notNull().default('standard'),
  },
  (table) => [
    index('idx_user_themes_user_current').on(table.userId, table.isCurrent),
    index('idx_user_themes_name').on(table.themeName),
    uniqueIndex('idx_user_themes_user_name').on(
      table.userId,
      table.themeName,
    ),
    index('idx_user_themes_market_id').on(table.themeMarketId),
    index('idx_user_themes_deploy_type').on(table.deployType),
  ],
);
