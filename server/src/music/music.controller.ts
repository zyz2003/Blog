import { Controller, Get, Post, Body } from '@nestjs/common';
import { MusicService } from './music.service';
import { GetSongResourcesDto } from './dto/get-song-resources.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * MusicController — matches Go MusicHandler.
 * Reference: pkg/handler/music/handler.go
 *
 * Both endpoints are @Public() (no auth required).
 * Response format is wrapped by global ResponseInterceptor as { code, data, message }.
 */
@Controller('public/music')
@Public()
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  /**
   * GET /api/public/music/playlist
   * Matches Go GetPlaylist — returns { songs, total }.
   * The global ResponseInterceptor wraps this as:
   * { code: 200, data: { songs, total }, message: 'OK' }
   */
  @Get('playlist')
  async getPlaylist() {
    const songs = await this.musicService.fetchPlaylist();
    return { songs, total: songs.length };
  }

  /**
   * POST /api/public/music/song-resources
   * Matches Go GetSongResources — accepts { neteaseId } and returns { audioUrl, lyricsText }.
   * The global ResponseInterceptor wraps this as:
   * { code: 200, data: { audioUrl, lyricsText }, message: 'OK' }
   */
  @Post('song-resources')
  async getSongResources(@Body() dto: GetSongResourcesDto) {
    return this.musicService.fetchSongResources(dto.neteaseId);
  }
}
