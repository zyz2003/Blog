import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * RSS API Compatibility Tests
 * Verifies all 3 RSS feed endpoints match Go backend response format.
 * RSS endpoints use @Res() to bypass ResponseInterceptor — they return raw XML.
 */
describe('RSS API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /rss.xml ────────────────────────────────────────────────

  describe('GET /rss.xml', () => {
    it('returns valid XML with Content-Type application/rss+xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      // RSS uses @Res() bypass — returns raw XML, not { code, data, message }
      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] || '';
      expect(contentType).toContain('application/rss+xml');
      // Should contain XML declaration or RSS root element
      expect(res.text).toContain('<?xml');
      expect(res.text).toContain('<rss');
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/rss.xml');

      expect(res.status).toBe(200);
    });
  });

  // ─── 2. GET /feed.xml ───────────────────────────────────────────────

  describe('GET /feed.xml', () => {
    it('returns valid XML with Content-Type application/rss+xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/feed.xml');

      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] || '';
      expect(contentType).toContain('application/rss+xml');
      expect(res.text).toContain('<?xml');
      expect(res.text).toContain('<rss');
    });
  });

  // ─── 3. GET /atom.xml ───────────────────────────────────────────────

  describe('GET /atom.xml', () => {
    it('returns valid XML with Content-Type application/atom+xml', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/atom.xml');

      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] || '';
      // Atom endpoint uses application/atom+xml Content-Type
      expect(contentType).toContain('application/atom+xml');
      expect(res.text).toContain('<?xml');
      // Same RSS 2.0 XML content, just different Content-Type
      expect(res.text).toContain('<rss');
    });
  });
});
