import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    ownerId: integer('owner_id').notNull().default(1),
    title: text('title').notNull(),
    contentMd: text('content_md'),
    contentHtml: text('content_html'),
    coverUrl: text('cover_url'),
    status: text('status').notNull().default('DRAFT'),
    viewCount: integer('view_count').notNull().default(0),
    wordCount: integer('word_count').notNull().default(0),
    readingTime: integer('reading_time').notNull().default(0),
    ipLocation: text('ip_location'),
    primaryColor: text('primary_color').default('#b4bfe2'),
    isPrimaryColorManual: integer('is_primary_color_manual', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    showOnHome: integer('show_on_home', { mode: 'boolean' })
      .notNull()
      .default(true),
    homeSort: integer('home_sort').notNull().default(0),
    pinSort: integer('pin_sort').notNull().default(0),
    topImgUrl: text('top_img_url'),
    summaries: text('summaries', { mode: 'json' }),
    abbrlink: text('abbrlink').unique(),
    copyright: integer('copyright', { mode: 'boolean' })
      .notNull()
      .default(true),
    isReprint: integer('is_reprint', { mode: 'boolean' })
      .notNull()
      .default(false),
    copyrightAuthor: text('copyright_author'),
    copyrightAuthorHref: text('copyright_author_href'),
    copyrightUrl: text('copyright_url'),
    keywords: text('keywords'),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
    reviewStatus: text('review_status').notNull().default('NONE'),
    reviewComment: text('review_comment'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewedBy: integer('reviewed_by'),
    isTakedown: integer('is_takedown', { mode: 'boolean' })
      .notNull()
      .default(false),
    takedownReason: text('takedown_reason'),
    takedownAt: integer('takedown_at', { mode: 'timestamp' }),
    takedownBy: integer('takedown_by'),
    extraConfig: text('extra_config', { mode: 'json' }),
    excludeFromMembership: integer('exclude_from_membership', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    isDoc: integer('is_doc', { mode: 'boolean' })
      .notNull()
      .default(false),
    docSeriesId: integer('doc_series_id'),
    docSort: integer('doc_sort').notNull().default(0),
    showRewardButton: integer('show_reward_button', { mode: 'boolean' })
      .notNull()
      .default(true),
    showShareButton: integer('show_share_button', { mode: 'boolean' })
      .notNull()
      .default(true),
    showSubscribeButton: integer('show_subscribe_button', {
      mode: 'boolean',
    })
      .notNull()
      .default(true),
  },
  (table) => [
    index('idx_articles_home_list').on(
      table.deletedAt,
      table.status,
      table.isTakedown,
      table.reviewStatus,
      table.showOnHome,
    ),
    index('idx_articles_sort').on(
      table.deletedAt,
      table.status,
      table.pinSort,
      table.createdAt,
    ),
    index('idx_articles_archive').on(
      table.deletedAt,
      table.status,
      table.createdAt,
    ),
    index('idx_articles_doc').on(
      table.deletedAt,
      table.isDoc,
      table.docSeriesId,
      table.docSort,
    ),
    index('idx_articles_owner').on(
      table.deletedAt,
      table.ownerId,
      table.status,
    ),
  ],
);
