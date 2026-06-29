import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { links } from './link.schema';
import { linkTags } from './link-tag.schema';

export const linkTagPivot = sqliteTable('link_tag_pivot', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  linkId: integer('link_id')
    .notNull()
    .references(() => links.id),
  linkTagId: integer('link_tag_id')
    .notNull()
    .references(() => linkTags.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
