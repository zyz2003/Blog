import { vi } from 'vitest';
import { initSqidsEncoderWithSeed, generatePublicID, EntityType } from '../../src/common/utils/sqids.util';

const TEST_SEED = 'unit-test-seed';

// Initialize Sqids once for all tests
initSqidsEncoderWithSeed(TEST_SEED);

// ─── Mock Article DB Row ──────────────────────────────────────────────

export function createMockArticle(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    createdAt: new Date('2025-01-15T08:30:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    deletedAt: null,
    ownerId: 1,
    title: 'Test Article',
    contentMd: '# Hello World\nThis is test content.',
    contentHtml: '<h1>Hello World</h1><p>This is test content.</p>',
    coverUrl: 'https://example.com/cover.jpg',
    status: 'PUBLISHED',
    viewCount: 100,
    wordCount: 8,
    readingTime: 1,
    ipLocation: 'Beijing',
    primaryColor: '#b4bfe2',
    isPrimaryColorManual: false,
    showOnHome: true,
    homeSort: 0,
    pinSort: 0,
    topImgUrl: 'https://example.com/top.jpg',
    summaries: 'Test summary',
    abbrlink: 'test-article',
    copyright: true,
    isReprint: false,
    copyrightAuthor: null,
    copyrightAuthorHref: null,
    copyrightUrl: null,
    keywords: 'test,article',
    scheduledAt: null,
    reviewStatus: 'NONE',
    isTakedown: false,
    takedownReason: null,
    takedownAt: null,
    takedownBy: null,
    extraConfig: null,
    isDoc: false,
    docSeriesId: null,
    docSort: 0,
    postCategories: [],
    postTags: [],
    owner: { id: 1, nickname: 'Admin', avatar: 'https://example.com/avatar.jpg', email: 'admin@test.com' },
    ...overrides,
  };
}

// ─── Mock Category DB Row ─────────────────────────────────────────────

export function createMockCategory(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    createdAt: new Date('2025-01-10T08:00:00Z'),
    updatedAt: new Date('2025-01-10T08:00:00Z'),
    deletedAt: null,
    name: 'Technology',
    slug: 'technology',
    description: 'Tech articles',
    count: 5,
    isSeries: false,
    sortOrder: 0,
    ...overrides,
  };
}

// ─── Mock Tag DB Row ──────────────────────────────────────────────────

export function createMockTag(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    createdAt: new Date('2025-01-10T08:00:00Z'),
    updatedAt: new Date('2025-01-10T08:00:00Z'),
    deletedAt: null,
    name: 'JavaScript',
    slug: 'javascript',
    count: 3,
    ...overrides,
  };
}

// ─── Mock History DB Row ──────────────────────────────────────────────

export function createMockHistory(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    createdAt: new Date('2025-01-15T08:30:00Z'),
    articleId: 1,
    version: 1,
    title: 'Test Article',
    contentMd: '# Hello World\nThis is test content.',
    contentHtml: '<h1>Hello World</h1><p>This is test content.</p>',
    coverUrl: 'https://example.com/cover.jpg',
    topImgUrl: 'https://example.com/top.jpg',
    primaryColor: '#b4bfe2',
    summaries: 'Test summary',
    wordCount: 8,
    keywords: 'test,article',
    editorId: 1,
    editorNickname: 'Admin',
    changeNote: 'Initial version',
    ...overrides,
  };
}

// ─── Mock DTOs ────────────────────────────────────────────────────────

export function createMockCreateArticleDto(overrides: Record<string, any> = {}) {
  return {
    title: 'New Article',
    content_md: '# New Article\nContent here.',
    content_html: '<h1>New Article</h1><p>Content here.</p>',
    status: 'DRAFT',
    cover_url: null,
    post_category_ids: [],
    post_tag_ids: [],
    abbrlink: null,
    ...overrides,
  };
}

export function createMockUpdateArticleDto(overrides: Record<string, any> = {}) {
  return {
    title: 'Updated Article',
    ...overrides,
  };
}

// ─── Mock DRIZZLE Provider ────────────────────────────────────────────

/**
 * Create a mock DRIZZLE provider that supports chainable Drizzle query builders.
 * Each method returns a new mock with .where(), .orderBy(), .limit(), .offset(), etc.
 */
export function createMockDb(queryResults: Record<string, any> = {}) {
  const defaultResults = {
    select: [],
    selectOne: null,
    insert: [{ id: 1 }],
    update: [{ id: 1 }],
    delete: [],
    count: [{ count: 0 }],
    ...queryResults,
  };

  const createChainable = (finalResult: any) => {
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(finalResult),
      innerJoin: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnThis(),
    };
    // Make the chainable itself thenable
    chain.then = (resolve: any, reject: any) => Promise.resolve(finalResult).then(resolve, reject);
    chain.catch = (reject: any) => Promise.resolve(finalResult).catch(reject);
    return chain;
  };

  const db: any = {
    select: vi.fn((fields?: any) => {
      const result = fields ? defaultResults.selectOne || defaultResults.select : defaultResults.select;
      return createChainable(result);
    }),
    insert: vi.fn(() => createChainable(defaultResults.insert)),
    update: vi.fn(() => createChainable(defaultResults.update)),
    delete: vi.fn(() => createChainable(defaultResults.delete)),
  };

  return db;
}

// ─── Pre-computed Sqids IDs for test seed ─────────────────────────────

export const TEST_IDS = {
  article1: generatePublicID(1, EntityType.Article),
  article2: generatePublicID(2, EntityType.Article),
  category1: generatePublicID(1, EntityType.PostCategory),
  category2: generatePublicID(2, EntityType.PostCategory),
  tag1: generatePublicID(1, EntityType.PostTag),
  tag2: generatePublicID(2, EntityType.PostTag),
  history1: generatePublicID(1, EntityType.ArticleHistory),
  user1: generatePublicID(1, EntityType.User),
  docSeries1: generatePublicID(1, EntityType.DocSeries),
};
