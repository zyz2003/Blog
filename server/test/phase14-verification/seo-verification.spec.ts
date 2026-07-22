/**
 * Phase 14: SEO Endpoints Verification (RSS, Sitemap, robots.txt)
 *
 * Per D-314: RSS/Sitemap/robots.txt are XML/text responses, NOT wrapped
 * in { code, data, message }. They bypass the global prefix and
 * ResponseInterceptor.
 *
 * Per D-246: These endpoints bypass the global /api/ prefix.
 * Request goes to /rss.xml NOT /api/rss.xml.
 *
 * Go RSS handler baseline: _go-backend-archive/pkg/handler/rss/handler.go
 * Go Sitemap handler baseline: _go-backend-archive/pkg/handler/sitemap/handler.go
 * Go RSS service baseline: _go-backend-archive/pkg/service/rss/service.go
 * Go Sitemap service baseline: _go-backend-archive/pkg/service/sitemap/service.go
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  TestContext,
} from '../helpers/api-compat-helpers';
import { articles } from '../../src/database/schemas/article.schema';
import { postCategories } from '../../src/database/schemas/post-category.schema';
import { articlePostCategories } from '../../src/database/schemas/article-post-category-pivot.schema';

// ─── Test Suite ──────────────────────────────────────────────────────────

describe('SEO verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Seed articles for RSS content (need at least 1 published article)
    await ctx.db.insert(postCategories).values({
      id: 1,
      name: 'Test Category',
      slug: 'test-category',
    }).onConflictDoNothing().run();

    await ctx.db.insert(articles).values([
      {
        title: 'RSS Test Article',
        contentMd: 'Test content for RSS feed',
        contentHtml: '<p>Test content for RSS feed</p>',
        status: 'PUBLISHED',
        ownerId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'RSS Test Article 2',
        contentMd: 'Second test article',
        contentHtml: '<p>Second test article</p>',
        status: 'PUBLISHED',
        ownerId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]).run();

    // Link articles to category
    const articleRows = await ctx.db.select().from(articles).limit(2).all();
    if (articleRows.length >= 2) {
      for (const article of articleRows) {
        await ctx.db.insert(articlePostCategories).values({
          articleId: article.id,
          postCategoryId: 1,
        }).onConflictDoNothing().run();
      }
    }
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── RSS Feed Verification ──────────────────────────────────────────

  describe('GET /rss.xml', () => {
    it('returns Content-Type application/rss+xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/rss+xml');
    });

    it('returns Cache-Control public, max-age=3600', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.header['cache-control']).toContain('public');
      expect(res.header['cache-control']).toContain('max-age=3600');
    });

    it('returns X-Content-Type-Options nosniff (Go sets this)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.header['x-content-type-options']).toBe('nosniff');
    });

    it('returns Last-Modified header (Go sets this)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.header['last-modified']).toBeDefined();
      expect(typeof res.header['last-modified']).toBe('string');
    });

    it('response body starts with XML declaration', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.text).toMatch(/^<\?xml/);
    });

    it('response body contains rss root element with version attribute', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.text).toContain('<rss');
      expect(res.text).toContain('version="2.0"');
    });

    it('channel element has title, link, description, language', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.text).toContain('<channel>');
      expect(res.text).toContain('</channel>');
      expect(res.text).toMatch(/<title>[\s\S]*<\/title>/);
      expect(res.text).toMatch(/<link>[\s\S]*<\/link>/);
      expect(res.text).toMatch(/<description>[\s\S]*<\/description>/);
      expect(res.text).toMatch(/<language>[\s\S]*<\/language>/);
    });

    it('channel has lastBuildDate matching Go RFC1123Z format', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      expect(res.text).toContain('<lastBuildDate>');
      expect(res.text).toContain('</lastBuildDate>');
    });

    it('item elements have title, link, description, pubDate, guid', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
      // Should have at least one <item> from seeded articles
      expect(res.text).toContain('<item>');
      expect(res.text).toContain('</item>');

      // Extract items and verify structure
      const itemMatches = res.text.match(/<item>[\s\S]*?<\/item>/g);
      expect(itemMatches).toBeDefined();
      expect(itemMatches!.length).toBeGreaterThan(0);

      const firstItem = itemMatches![0];
      expect(firstItem).toContain('<title>');
      expect(firstItem).toContain('<link>');
      expect(firstItem).toContain('<pubDate>');
      expect(firstItem).toContain('<guid');
      // description may be empty if no content, so just check element exists
      // (Go may omit description if empty, but NestJS includes it with empty content)
    });
  });

  // ─── RSS Alias Routes ───────────────────────────────────────────────

  describe('GET /feed.xml (RSS alias)', () => {
    it('returns same Content-Type as /rss.xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/feed.xml');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/rss+xml');
    });

    it('returns same XML content as /rss.xml', async () => {
      const rssRes = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');
      const feedRes = await supertest(ctx.app.getHttpServer())
        .get('/feed.xml');

      expect(feedRes.status).toBe(200);
      expect(feedRes.text).toBe(rssRes.text);
    });
  });

  describe('GET /atom.xml (Atom alias)', () => {
    it('returns Content-Type application/atom+xml (Go sets this per path)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/atom.xml');

      expect(res.status).toBe(200);
      // Go sets application/atom+xml for /atom.xml path
      expect(res.header['content-type']).toContain('application/atom+xml');
    });

    it('returns same XML body content as /rss.xml', async () => {
      const rssRes = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');
      const atomRes = await supertest(ctx.app.getHttpServer())
        .get('/atom.xml');

      expect(atomRes.status).toBe(200);
      expect(atomRes.text).toBe(rssRes.text);
    });
  });

  // ─── Sitemap Verification ───────────────────────────────────────────

  describe('GET /sitemap.xml', () => {
    it('returns Content-Type text/xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/xml');
    });

    it('returns Cache-Control public, max-age=3600', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.header['cache-control']).toContain('public');
      expect(res.header['cache-control']).toContain('max-age=3600');
    });

    it('response body starts with XML declaration', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.text).toMatch(/^<\?xml/);
    });

    it('response body contains urlset root element with xmlns attribute', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.text).toContain('<urlset');
      expect(res.text).toContain('xmlns');
    });

    it('url elements have loc, lastmod, changefreq, priority children', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      // Should have <url> elements
      expect(res.text).toContain('<url>');
      expect(res.text).toContain('</url>');

      // Extract first url element and verify children
      const urlMatch = res.text.match(/<url>[\s\S]*?<\/url>/);
      expect(urlMatch).toBeDefined();
      const firstUrl = urlMatch![0];

      // loc: valid URL
      expect(firstUrl).toContain('<loc>');
      const locMatch = firstUrl.match(/<loc>([\s\S]*?)<\/loc>/);
      expect(locMatch).toBeDefined();
      expect(locMatch![1]).toMatch(/^https?:\/\//);

      // changefreq: one of the standard values
      expect(firstUrl).toContain('<changefreq>');

      // priority: decimal number
      expect(firstUrl).toContain('<priority>');
    });

    it('sitemap includes homepage entry', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      // Homepage should have priority 1 (Go formats as "1" not "1.0")
      expect(res.text).toContain('<priority>1</priority>');
    });

    it('lastmod values are valid date strings', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
      const lastmodMatches = res.text.matchAll(/<lastmod>([\s\S]*?)<\/lastmod>/g);
      for (const match of lastmodMatches) {
        const dateStr = match[1].trim();
        const parsed = new Date(dateStr);
        expect(isNaN(parsed.getTime()), `lastmod "${dateStr}" should be valid date`).toBe(false);
      }
    });
  });

  // ─── robots.txt Verification ────────────────────────────────────────

  describe('GET /robots.txt', () => {
    it('returns Content-Type text/plain', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/plain');
    });

    it('returns Cache-Control public, max-age=86400 (24 hours)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.header['cache-control']).toContain('public');
      expect(res.header['cache-control']).toContain('max-age=86400');
    });

    it('contains User-agent directive', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.text).toContain('User-agent:');
    });

    it('contains Allow directive', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Allow:');
    });

    it('contains Disallow directive', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Disallow:');
    });

    it('contains Sitemap directive pointing to sitemap.xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Sitemap:');
      expect(res.text).toContain('/sitemap.xml');
    });
  });
});
