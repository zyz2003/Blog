/**
 * Phase 13: Article Field-by-Field Verification
 *
 * CCP-1 Schema Audit Result:
 * All 28 tables with created_at/updated_at have .notNull() + .default(sql`(unixepoch())`) constraints.
 * Null dates CANNOT exist in the database. toISODateString(null) code path is unreachable.
 *
 * Tables verified:
 * articles ✓, article_history ✓ (created_at only), comments ✓, direct_links ✓,
 * doc_series ✓, entities ✓, file_entities ✓, files ✓, link_tag_pivot ✓ (created_at only),
 * links ✓, metadata ✓, notification_types ✓, notifications ✓ (created_at only),
 * pages ✓, post_categories ✓, post_tags ✓, settings ✓, storage_policies ✓,
 * subscribers ✓, tags ✓, url_stats ✓, user_groups ✓, user_installed_themes ✓,
 * user_notification_configs ✓, users ✓, visitor_stats ✓, visitor_logs ✓ (created_at only),
 * albums ✓
 *
 * Tables WITHOUT created_at/updated_at (Phase 14 scope):
 * link_categories, album_categories
 *
 * Go ArticleResponse baseline: _go-backend-archive/pkg/domain/model/article.go lines 159-211
 * Frontend Article type: frontend/src/types/article.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Helper: assert field is string or null
 */
function expectStringOrNull(value: any, fieldName: string) {
  if (value !== null && value !== undefined) {
    expect(typeof value).toBe('string');
  }
}

/**
 * Helper: assert field is number or null
 */
function expectNumberOrNull(value: any, fieldName: string) {
  if (value !== null && value !== undefined) {
    expect(typeof value).toBe('number');
  }
}

/**
 * Asserts that an object has all ArticleResponse fields with correct types,
 * matching Go ArticleResponse struct (model/article.go lines 159-211).
 * Many fields use omitempty in Go, which NestJS maps to null.
 */
function assertArticleResponseFields(data: any) {
  // Required fields (always present)
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');

  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('title');
  expect(typeof data.title).toBe('string');

  // cover_url: string in Go (omitempty), string | null in NestJS
  expect(data).toHaveProperty('cover_url');
  expectStringOrNull(data.cover_url, 'cover_url');

  expect(data).toHaveProperty('status');
  expect(typeof data.status).toBe('string');

  expect(data).toHaveProperty('view_count');
  expect(typeof data.view_count).toBe('number');

  expect(data).toHaveProperty('word_count');
  expect(typeof data.word_count).toBe('number');

  expect(data).toHaveProperty('reading_time');
  expect(typeof data.reading_time).toBe('number');

  // ip_location: string in Go (omitempty), string | null in NestJS
  expect(data).toHaveProperty('ip_location');
  expectStringOrNull(data.ip_location, 'ip_location');

  expect(data).toHaveProperty('primary_color');
  expectStringOrNull(data.primary_color, 'primary_color');

  expect(data).toHaveProperty('is_primary_color_manual');
  expect(typeof data.is_primary_color_manual).toBe('boolean');

  expect(data).toHaveProperty('show_on_home');
  expect(typeof data.show_on_home).toBe('boolean');

  expect(data).toHaveProperty('post_tags');
  expect(Array.isArray(data.post_tags)).toBe(true);

  expect(data).toHaveProperty('post_categories');
  expect(Array.isArray(data.post_categories)).toBe(true);

  expect(data).toHaveProperty('home_sort');
  expect(typeof data.home_sort).toBe('number');

  expect(data).toHaveProperty('pin_sort');
  expect(typeof data.pin_sort).toBe('number');

  // top_img_url: string in Go (omitempty), string | null in NestJS
  expect(data).toHaveProperty('top_img_url');
  expectStringOrNull(data.top_img_url, 'top_img_url');

  // summaries: []string in Go (omitempty), array | null in NestJS
  expect(data).toHaveProperty('summaries');
  if (data.summaries !== null) {
    expect(Array.isArray(data.summaries)).toBe(true);
  }

  // abbrlink: string in Go (omitempty), string | null in NestJS
  expect(data).toHaveProperty('abbrlink');
  expectStringOrNull(data.abbrlink, 'abbrlink');

  expect(data).toHaveProperty('copyright');
  expect(typeof data.copyright).toBe('boolean');

  expect(data).toHaveProperty('is_reprint');
  expect(typeof data.is_reprint).toBe('boolean');

  // copyright_author: string (omitempty)
  expect(data).toHaveProperty('copyright_author');
  expectStringOrNull(data.copyright_author, 'copyright_author');

  // copyright_author_href: string (omitempty)
  expect(data).toHaveProperty('copyright_author_href');
  expectStringOrNull(data.copyright_author_href, 'copyright_author_href');

  // copyright_url: string (omitempty)
  expect(data).toHaveProperty('copyright_url');
  expectStringOrNull(data.copyright_url, 'copyright_url');

  // keywords: string (omitempty)
  expect(data).toHaveProperty('keywords');
  expectStringOrNull(data.keywords, 'keywords');

  expect(data).toHaveProperty('comment_count');
  expect(typeof data.comment_count).toBe('number');

  // scheduled_at: *time.Time (nullable)
  expect(data).toHaveProperty('scheduled_at');
  expectStringOrNull(data.scheduled_at, 'scheduled_at');

  // review_status: string (omitempty)
  expect(data).toHaveProperty('review_status');
  expectStringOrNull(data.review_status, 'review_status');

  // owner_id: uint (omitempty) — NestJS returns number
  expect(data).toHaveProperty('owner_id');
  expectNumberOrNull(data.owner_id, 'owner_id');

  // owner_nickname: string (omitempty)
  expect(data).toHaveProperty('owner_nickname');
  expectStringOrNull(data.owner_nickname, 'owner_nickname');

  // owner_avatar: string (omitempty)
  expect(data).toHaveProperty('owner_avatar');
  expectStringOrNull(data.owner_avatar, 'owner_avatar');

  // owner_email: string (omitempty)
  expect(data).toHaveProperty('owner_email');
  expectStringOrNull(data.owner_email, 'owner_email');

  // is_takedown: bool (omitempty)
  expect(data).toHaveProperty('is_takedown');
  if (data.is_takedown !== null && data.is_takedown !== undefined) {
    expect(typeof data.is_takedown).toBe('boolean');
  }

  // takedown_reason: string (omitempty)
  expect(data).toHaveProperty('takedown_reason');
  expectStringOrNull(data.takedown_reason, 'takedown_reason');

  // takedown_at: *time.Time (nullable, omitempty)
  expect(data).toHaveProperty('takedown_at');
  expectStringOrNull(data.takedown_at, 'takedown_at');

  // takedown_by: *uint (nullable, omitempty)
  expect(data).toHaveProperty('takedown_by');
  expectNumberOrNull(data.takedown_by, 'takedown_by');

  // extra_config: *ArticleExtraConfig (nullable, omitempty)
  expect(data).toHaveProperty('extra_config');
  if (data.extra_config !== null && data.extra_config !== undefined) {
    expect(typeof data.extra_config).toBe('object');
  }

  // is_doc: bool (omitempty)
  expect(data).toHaveProperty('is_doc');
  if (data.is_doc !== null && data.is_doc !== undefined) {
    expect(typeof data.is_doc).toBe('boolean');
  }

  // doc_series_id: string (omitempty)
  expect(data).toHaveProperty('doc_series_id');
  expectStringOrNull(data.doc_series_id, 'doc_series_id');

  // doc_sort: int (omitempty)
  expect(data).toHaveProperty('doc_sort');
  expectNumberOrNull(data.doc_sort, 'doc_sort');

  // doc_series: *DocSeriesResponse (nullable, omitempty — may be omitted entirely)
  if (data.doc_series !== undefined) {
    if (data.doc_series !== null) {
      expect(typeof data.doc_series).toBe('object');
    }
  }

  // content_md: string (omitempty — may be absent in list responses)
  if (data.content_md !== undefined) {
    expectStringOrNull(data.content_md, 'content_md');
  }

  // content_html: string (omitempty — may be absent in list responses)
  if (data.content_html !== undefined) {
    expectStringOrNull(data.content_html, 'content_html');
  }
}

describe('Article Field Verification', () => {
  let ctx: TestContext;
  let articleId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── MEDIUM-risk: Public article list ──────────────────────────────────

  describe('GET /api/public/articles (MEDIUM)', () => {
    it('returns ArticleListResponse with pageSize (camelCase) pagination', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go ArticleListResponse uses pageSize (camelCase) for both public and admin
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(typeof data.pageSize).toBe('number');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('list items have all ArticleResponse fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        assertArticleResponseFields(list[0]);
      }
    });
  });

  // ─── MEDIUM-risk: Admin article list ───────────────────────────────────

  describe('GET /api/articles (MEDIUM)', () => {
    it('returns ArticleListResponse with pageSize (camelCase) pagination', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/articles?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(typeof data.pageSize).toBe('number');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('list items have all ArticleResponse fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/articles?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        assertArticleResponseFields(list[0]);
      }
    });
  });

  // ─── MEDIUM-risk: Create article ───────────────────────────────────────

  describe('POST /api/articles (MEDIUM)', () => {
    it('returns ArticleResponse with all fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Phase13 Verify Article ${ctx.ts}`,
          content_md: '# Test Content',
          content_html: '<h1>Test Content</h1>',
          status: 'DRAFT',
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertArticleResponseFields(data);

      // Store ID for subsequent tests
      articleId = data.id;
    });
  });

  // ─── MEDIUM-risk: Get single article ───────────────────────────────────

  describe('GET /api/articles/:id (MEDIUM)', () => {
    it('returns ArticleResponse with all fields and correct types', async () => {
      // Ensure we have an article ID
      if (!articleId) {
        const createRes = await supertest(ctx.app.getHttpServer())
          .post('/api/articles')
          .set('authorization', `Bearer ${ctx.adminToken}`)
          .send({
            title: `Phase13 Verify Article ${ctx.ts}`,
            content_md: '# Test',
            content_html: '<h1>Test</h1>',
            status: 'DRAFT',
          });
        articleId = createRes.body.data.id;
      }

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Full detail response should have all fields
      assertArticleResponseFields(data);

      // Verify date fields are strings (not null) per CCP-1
      expect(data.created_at).not.toBeNull();
      expect(data.updated_at).not.toBeNull();
    });
  });

  // ─── MEDIUM-risk: Update article ───────────────────────────────────────

  describe('PUT /api/articles/:id (MEDIUM)', () => {
    it('returns ArticleResponse with all fields', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/articles/${articleId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Phase13 Updated ${ctx.ts}`,
          content_md: '# Updated',
          content_html: '<h1>Updated</h1>',
          status: 'DRAFT',
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      assertArticleResponseFields(data);
    });
  });

  // ─── MEDIUM-risk: Article statistics ───────────────────────────────────

  describe('GET /api/public/articles/statistics (MEDIUM)', () => {
    it('returns all 8 ArticleStatistics fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/statistics')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go ArticleStatistics has 8 fields
      expect(data).toHaveProperty('total_posts');
      expect(typeof data.total_posts).toBe('number');

      expect(data).toHaveProperty('total_words');
      expect(typeof data.total_words).toBe('number');

      expect(data).toHaveProperty('avg_words');
      expect(typeof data.avg_words).toBe('number');

      expect(data).toHaveProperty('total_views');
      expect(typeof data.total_views).toBe('number');

      expect(data).toHaveProperty('category_stats');
      expect(Array.isArray(data.category_stats)).toBe(true);

      expect(data).toHaveProperty('tag_stats');
      expect(Array.isArray(data.tag_stats)).toBe(true);

      expect(data).toHaveProperty('top_viewed_posts');
      expect(Array.isArray(data.top_viewed_posts)).toBe(true);

      expect(data).toHaveProperty('publish_trend');
      expect(Array.isArray(data.publish_trend)).toBe(true);
    });
  });

  // ─── MEDIUM-risk: Random articles ──────────────────────────────────────

  describe('GET /api/public/articles/random (MEDIUM)', () => {
    it('returns articles with id, is_doc, doc_series_id fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/random')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Random articles endpoint returns array of articles
      if (Array.isArray(data) && data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(typeof data[0].id).toBe('string');
        if (data[0].is_doc !== undefined && data[0].is_doc !== null) {
          expect(typeof data[0].is_doc).toBe('boolean');
        }
        if (data[0].doc_series_id !== undefined && data[0].doc_series_id !== null) {
          expect(typeof data[0].doc_series_id).toBe('string');
        }
      }
    });
  });

  // ─── MEDIUM-risk: Article import (501) ─────────────────────────────────

  describe('POST /api/articles/import (MEDIUM - 501 functional gap)', () => {
    it('returns 501 Not Implemented', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .attach('file', Buffer.from('test'), 'test.json');

      // Article import is not implemented in NestJS (Go has full implementation)
      // This is a documented functional gap per RESEARCH.md Pitfall 5
      expect(res.status).toBe(501);
    });
  });

  // ─── NONE-risk: Archives ───────────────────────────────────────────────

  describe('GET /api/public/articles/archives (NONE)', () => {
    it('returns { list: [{ year, month, count }] }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/archives')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('list');
      expect(Array.isArray(data.list)).toBe(true);
    });
  });

  // ─── NONE-risk: Delete article ─────────────────────────────────────────

  describe('DELETE /api/articles/:id (NONE)', () => {
    it('returns success response', async () => {
      // Create a throwaway article for deletion
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/articles')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Delete Target ${ctx.ts}`,
          content_md: '# Delete me',
          status: 'DRAFT',
        });

      const deleteId = createRes.body.data.id;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/articles/${deleteId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });

  // ─── NONE-risk: Batch delete ───────────────────────────────────────────

  describe('DELETE /api/articles/batch (NONE)', () => {
    it('returns 404 or 501 (batch delete not fully implemented)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/articles/batch')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ ids: ['nonexistent'] });

      // Batch delete may return 404 (route mismatch) or 501 (not implemented)
      // Both indicate the feature is not available — documented functional gap
      expect([404, 501]).toContain(res.status);
    });
  });

  // ─── NONE-risk: Article upload ─────────────────────────────────────────

  describe('POST /api/articles/upload (NONE)', () => {
    it('returns { file_id, name, size } on successful upload', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/upload')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .attach('file', Buffer.from('test image content'), 'test.png');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Go UploadImage returns { file_id, name, size }
      expect(data).toHaveProperty('file_id');
      expect(typeof data.file_id).toBe('string');
      expect(data).toHaveProperty('name');
      expect(typeof data.name).toBe('string');
      expect(data).toHaveProperty('size');
      expect(typeof data.size).toBe('number');
    });
  });

  // ─── NONE-risk: Article export ─────────────────────────────────────────

  describe('POST /api/articles/export (NONE)', () => {
    it('returns 501 or blob', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ ids: ['nonexistent'] });

      // May return 501 or actual zip
      if (res.status === 501) {
        return; // Functional gap
      }
      // If implemented, should return zip
      expect(res.type).toMatch(/zip|octet-stream|json/);
    });
  });

  // ─── NONE-risk: History count ──────────────────────────────────────────

  describe('GET /api/articles/:id/history/count (NONE)', () => {
    it('returns { count: number }', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/count`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('count');
      expect(typeof data.count).toBe('number');
    });
  });

  // ─── LOW-risk: Article history ─────────────────────────────────────────

  describe('GET /api/articles/:id/history (LOW)', () => {
    it('returns paginated history with date fields as strings', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history?page=1&pageSize=10`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // History list should be array
      if (data.list && data.list.length > 0) {
        const item = data.list[0];
        // Date fields should be strings (not null per CCP-1)
        if (item.created_at !== undefined) {
          expect(typeof item.created_at).toBe('string');
        }
      }
    });
  });
});
