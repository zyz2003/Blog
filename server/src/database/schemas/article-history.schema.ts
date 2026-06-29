import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const articleHistories = sqliteTable(
  'article_histories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    articleId: integer('article_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    contentMd: text('content_md'),
    contentHtml: text('content_html'),
    coverUrl: text('cover_url'),
    topImgUrl: text('top_img_url'),
    primaryColor: text('primary_color'),
    summaries: text('summaries', { mode: 'json' }),
    wordCount: integer('word_count').notNull().default(0),
    keywords: text('keywords'),
    editorId: integer('editor_id').notNull(),
    editorNickname: text('editor_nickname'),
    changeNote: text('change_note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    extraData: text('extra_data', { mode: 'json' }),
  },
  (table) => [
    uniqueIndex('idx_article_histories_article_version').on(
      table.articleId,
      table.version,
    ),
    index('idx_article_histories_article_created').on(
      table.articleId,
      table.createdAt,
    ),
    index('idx_article_histories_editor').on(table.editorId),
  ],
);
