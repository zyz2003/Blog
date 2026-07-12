import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { albumCategories } from './album-category.schema';

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  imageUrl: text('image_url').notNull(),
  bigImageUrl: text('big_image_url'),
  downloadUrl: text('download_url'),
  thumbParam: text('thumb_param'),
  bigParam: text('big_param'),
  tags: text('tags'),
  viewCount: integer('view_count').notNull().default(0),
  downloadCount: integer('download_count').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  fileSize: integer('file_size'),
  format: text('format'),
  aspectRatio: text('aspect_ratio'),
  fileHash: text('file_hash').unique(),
  displayOrder: integer('display_order').notNull().default(0),
  categoryId: integer('category_id').references(() => albumCategories.id, { onDelete: 'set null' }),
  title: text('title'),
  description: text('description'),
  location: text('location'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
});
