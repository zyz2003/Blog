/**
 * Phase 14: Music Playlist Verification
 *
 * Verifies Music playlist endpoint response structure matches Go backend.
 * Go reference: _go-backend-archive/pkg/handler/music/handler.go
 *   - GetPlaylist returns gin.H{ "songs": songs, "total": len(songs) }
 *   - Song struct: { id, neteaseId, name, artist, url, pic, lrc } (all strings)
 *
 * Note: Music endpoint depends on external API (metings.qjqq.cn).
 * If the external API is unavailable, the test verifies error response format.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Assert Song object has all 7 fields matching Go Song struct.
 * Go Song: { id, neteaseId, name, artist, url, pic, lrc } — all strings.
 */
function assertSongFields(song: any) {
  expect(song).toHaveProperty('id');
  expect(typeof song.id).toBe('string');

  expect(song).toHaveProperty('neteaseId');
  expect(typeof song.neteaseId).toBe('string');

  expect(song).toHaveProperty('name');
  expect(typeof song.name).toBe('string');

  expect(song).toHaveProperty('artist');
  expect(typeof song.artist).toBe('string');

  expect(song).toHaveProperty('url');
  expect(typeof song.url).toBe('string');

  expect(song).toHaveProperty('pic');
  expect(typeof song.pic).toBe('string');

  expect(song).toHaveProperty('lrc');
  expect(typeof song.lrc).toBe('string');
}

describe('Music Playlist Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── LOW-risk: Music playlist ──────────────────────────────────────────

  describe('GET /api/public/music/playlist (LOW)', () => {
    it('returns { code, data: { songs, total } } matching Go gin.H structure', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/music/playlist');

      // External API may be unavailable — handle both success and error
      if (res.status === 200 && res.body.code === 200) {
        assertSuccessResponse(res);
        const data = res.body.data;

        // Go: gin.H{ "songs": songs, "total": len(songs) }
        expect(data).toHaveProperty('songs');
        expect(data).toHaveProperty('total');
        expect(typeof data.total).toBe('number');
        expect(Array.isArray(data.songs)).toBe(true);

        // total must equal songs.length (Go: len(songs))
        expect(data.total).toBe(data.songs.length);
      } else {
        // External API unavailable — verify error response format
        assertErrorResponse(res, 500);
      }
    });

    it('each Song has 7 fields: id, neteaseId, name, artist, url, pic, lrc (all strings)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/music/playlist');

      // Only verify Song structure if playlist returned successfully
      if (res.status === 200 && res.body.code === 200 && res.body.data.songs.length > 0) {
        const firstSong = res.body.data.songs[0];
        assertSongFields(firstSong);
      }
    });

    it('total equals songs array length (Go: len(songs))', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/music/playlist');

      if (res.status === 200 && res.body.code === 200) {
        const data = res.body.data;
        expect(data.total).toBe(data.songs.length);
      }
    });
  });

  // ─── LOW-risk: Song resources ──────────────────────────────────────────

  describe('POST /api/public/music/song-resources (LOW)', () => {
    it('returns { audioUrl, lyricsText } for valid neteaseId', async () => {
      // Use a well-known Netease Cloud Music ID
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/music/song-resources')
        .send({ neteaseId: '347230' });

      // External API may be unavailable
      if (res.status === 200 && res.body.code === 200) {
        assertSuccessResponse(res);
        const data = res.body.data;

        // Go SongResourceResponse: { audioUrl, lyricsText }
        expect(data).toHaveProperty('audioUrl');
        expect(typeof data.audioUrl).toBe('string');

        expect(data).toHaveProperty('lyricsText');
        expect(typeof data.lyricsText).toBe('string');
      } else {
        // External API error — verify error format
        expect(res.body).toHaveProperty('code');
        expect(res.body).toHaveProperty('message');
      }
    });

    it('returns 500 for invalid neteaseId (Go: InternalServerError)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/music/song-resources')
        .send({ neteaseId: 'invalid' });

      // Go returns 500 for invalid NeteaseID
      assertErrorResponse(res, 500);
    });
  });
});
