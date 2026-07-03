import { sqliteTable, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { articles } from './article.schema';
import { postCategories } from './post-category.schema';

/**
 * Article-PostCategory junction table (many-to-many).
 * Matches Go ent/migrate/schema.go ArticlePostCategoriesTable.
 * Composite PK on (article_id, post_category_id) with FK cascade deletes.
 */
export const articlePostCategories = sqliteTable(
  'article_post_categories',
  {
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    postCategoryId: integer('post_category_id')
      .notNull()
      .references(() => postCategories.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.postCategoryId] }),
  ],
);
