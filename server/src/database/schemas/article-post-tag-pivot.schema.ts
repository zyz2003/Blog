import { sqliteTable, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { articles } from './article.schema';
import { postTags } from './post-tag.schema';

/**
 * Article-PostTag junction table (many-to-many).
 * Matches Go ent/migrate/schema.go ArticlePostTagsTable.
 * Composite PK on (article_id, post_tag_id) with FK cascade deletes.
 */
export const articlePostTags = sqliteTable(
  'article_post_tags',
  {
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    postTagId: integer('post_tag_id')
      .notNull()
      .references(() => postTags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.postTagId] }),
  ],
);
