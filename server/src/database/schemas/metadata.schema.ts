import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const metadatas = sqliteTable(
  'metadatas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    name: text('name').notNull(),
    value: text('value'),
    fileId: integer('file_id').notNull(),
  },
  (table) => [
    uniqueIndex('idx_file_meta_name').on(table.fileId, table.name),
  ],
);
