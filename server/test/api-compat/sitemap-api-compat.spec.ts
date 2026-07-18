import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Sitemap API Compatibility Tests
 * Verifies sitemap.xml and robots.txt endpoints match Go backend response format.
 * Both endpoints use @Res() to bypass ResponseInterceptor — they return raw content.
 */
describe('Sitemap API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /sitemap.xml ────────────────────────────────────────────

  describe('GET /sitemap.xml', () => {
    it('returns valid XML with Content-Type text/xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      // Sitemap uses @Res() bypass — returns raw XML
      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] || '';
      expect(contentType).toContain('text/xml');
      // Should contain XML declaration and urlset root element
      expect(res.text).toContain('<?xml');
      expect(res.text).toContain('<urlset');
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/sitemap.xml');

      expect(res.status).toBe(200);
    });
  });

  // ─── 2. GET /robots.txt ─────────────────────────────────────────────

  describe('GET /robots.txt', () => {
    it('returns text/plain with robots content', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      // Robots.txt uses @Res() bypass — returns plain text
      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] || '';
      expect(contentType).toContain('text/plain');
      // Should contain at least User-agent or Sitemap directive
      const text = res.text;
      expect(
        text.includes('User-agent') || text.includes('Sitemap'),
      ).toBe(true);
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/robots.txt');

      expect(res.status).toBe(200);
    });
  });
});
