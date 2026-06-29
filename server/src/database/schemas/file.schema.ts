import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const files = sqliteTable(
  'files',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    type: integer('type').notNull(),
    ownerId: integer('owner_id').notNull(),
    parentId: integer('parent_id'),
    name: text('name').notNull(),
    size: integer('size').notNull().default(0),
    primaryEntityId: integer('primary_entity_id'),
    childrenCount: integer('children_count').notNull().default(0),
    viewConfig: text('view_config', { mode: 'json' }),
  },
  (table) => [
    uniqueIndex('idx_files_parent_name_owner').on(
      table.parentId,
      table.name,
      table.ownerId,
    ),
  ],
);
