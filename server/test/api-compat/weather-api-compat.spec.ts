import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Weather API Compatibility Tests
 * Verifies the weather/IP-location endpoint matches Go backend response format.
 *
 * Endpoints:
 *   GET /api/public/weather/ip-location — IP location for weather widget (public)
 */
describe('Weather API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/public/weather/ip-location (public) ────────────────

  describe('GET /api/public/weather/ip-location', () => {
    it('returns { code, data: IPLocationResponse, message } without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/weather/ip-location');

      assertSuccessResponse(res);
      const data = res.body.data;
      // IPLocationResponse has ip, country, province, city, isp, latitude, longitude, address
      expect(data).toHaveProperty('ip');
      expect(data).toHaveProperty('country');
      expect(data).toHaveProperty('province');
      expect(data).toHaveProperty('city');
      expect(data).toHaveProperty('isp');
      expect(data).toHaveProperty('latitude');
      expect(data).toHaveProperty('longitude');
      expect(data).toHaveProperty('address');
    });

    it('returns location data for test request (likely LAN/private IP)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/weather/ip-location');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Test environment uses 127.0.0.1 — should return LAN fallback
      expect(typeof data.ip).toBe('string');
      expect(data.ip.length).toBeGreaterThan(0);
      // For private IPs, country/province may be "局域网"
      expect(typeof data.country).toBe('string');
      expect(typeof data.province).toBe('string');
    });

    it('does not require authentication (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/weather/ip-location');

      // Should not return 401
      expect(res.status).not.toBe(401);
    });
  });
});
